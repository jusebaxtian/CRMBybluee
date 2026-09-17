import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addBillingCycle } from "@/lib/billing/cycle";
import { SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Pagos registrados por soporte desde el chat (ver migracion 0105).
 * Todo corre con el cliente de servicio: lo llama una accion que ya
 * verifico que quien actua es administrador, o el registro con invitacion.
 */

const DIAS_AVISO_CUENTA_CREADA = 3;

export type PlanBasico = { id: string; name: string; price_cents: number; currency: string; billing_cycle: string };

/** Copia el comprobante del chat (bucket chat-media) al bucket de comprobantes de pago. */
export async function copiarComprobante(admin: SupabaseClient, mediaUrl: string | null): Promise<string | null> {
  if (!mediaUrl) return null;
  const prefijo = `${SUPABASE_URL}/storage/v1/object/public/chat-media/`;
  if (!mediaUrl.startsWith(prefijo)) return null;
  const ruta = decodeURIComponent(mediaUrl.slice(prefijo.length));
  const { data, error } = await admin.storage.from("chat-media").download(ruta);
  if (error || !data) return null;
  const nombre = ruta.split("/").pop() ?? "comprobante";
  const destino = `soporte/${Date.now()}-${nombre}`;
  const { error: errSubida } = await admin.storage
    .from("payment-proofs")
    .upload(destino, data, { contentType: data.type || undefined });
  return errSubida ? null : destino;
}

/**
 * Aplica un pago a un espacio: pago aprobado, plan, suscripcion activa por
 * el ciclo del plan y espacio activo. Devuelve el id del pago.
 */
export async function activarEspacioConPago(
  admin: SupabaseClient,
  input: {
    workspaceId: string;
    plan: PlanBasico;
    amountCents: number;
    proofPath: string | null;
    revisadoPor: string | null;
    contactId?: string | null;
    /** Vencimiento fijado a mano por soporte; si falta, se calcula con el ciclo del plan. */
    venceEl?: Date | null;
    /** Demo sin pago: activo estos dias; no se crea pago (migracion 0111). */
    diasDemo?: number | null;
  }
): Promise<{ paymentId: string | null } | { error: string }> {
  const { data: ws } = await admin.from("workspaces").select("name, phone, cliente_contact_id").eq("id", input.workspaceId).maybeSingle();
  if (!ws) return { error: "Espacio no encontrado." };

  const ahora = new Date().toISOString();
  const esDemo = !!input.diasDemo;
  if (esDemo) {
    // Demo: sin pago, activo N dias desde hoy. ever_activated queda como
    // este para que, al vencer, se vea como prueba vencida y no como pago pendiente.
    const vence = new Date(Date.now() + (input.diasDemo as number) * 24 * 60 * 60 * 1000);
    await admin.from("subscriptions").insert({
      workspace_id: input.workspaceId,
      provider: "manual",
      status: "active",
      current_period_end: vence.toISOString(),
    });
    await admin
      .from("workspaces")
      .update({
        plan_id: input.plan.id,
        status: "active",
        ...(input.contactId && !ws.cliente_contact_id ? { cliente_contact_id: input.contactId } : {}),
      })
      .eq("id", input.workspaceId);
    return { paymentId: null };
  }

  const { data: pago, error: errPago } = await admin
    .from("payments")
    .insert({
      workspace_id: input.workspaceId,
      provider: "manual",
      amount_cents: input.amountCents,
      currency: input.plan.currency || "COP",
      status: "approved",
      proof_path: input.proofPath,
      reviewed_by: input.revisadoPor,
      reviewed_at: ahora,
      source: "soporte",
      workspace_name: ws.name,
      workspace_phone: ws.phone,
    })
    .select("id")
    .single();
  if (errPago || !pago) return { error: errPago?.message ?? "No se pudo guardar el pago." };

  // La suscripcion arranca hoy; si tenia una vigente, se extiende desde su vencimiento.
  const { data: vigente } = await admin
    .from("subscriptions")
    .select("current_period_end")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active")
    .gt("current_period_end", ahora)
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  const desde = vigente ? new Date(vigente.current_period_end) : new Date();
  const vence = input.venceEl ?? addBillingCycle(desde, input.plan.billing_cycle);
  await admin.from("subscriptions").insert({
    workspace_id: input.workspaceId,
    provider: "manual",
    status: "active",
    current_period_end: vence.toISOString(),
  });

  await admin
    .from("workspaces")
    .update({
      plan_id: input.plan.id,
      status: "active",
      ever_activated: true,
      ...(input.contactId && !ws.cliente_contact_id ? { cliente_contact_id: input.contactId } : {}),
    })
    .eq("id", input.workspaceId);

  return { paymentId: pago.id };
}

export function nuevoTokenInvitacion(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Registro con invitacion: el espacio recien creado nace activo con el plan
 * pagado, el pago queda enlazado y la invitacion marcada como usada.
 */
export async function aplicarInvitacionRegistro(
  admin: SupabaseClient,
  token: string,
  workspaceId: string
): Promise<void> {
  const { data: inv } = await admin
    .from("invitaciones_registro")
    .select("id, contact_id, created_by, plan_id, amount_cents, proof_path, status, vence_el, tipo, dias_demo, plans(id, name, price_cents, currency, billing_cycle)")
    .eq("token", token)
    .maybeSingle();
  if (!inv || inv.status !== "pending") return;
  const plan = inv.plans as unknown as PlanBasico | null;
  if (!plan) return;

  const r = await activarEspacioConPago(admin, {
    workspaceId,
    plan,
    amountCents: Number(inv.amount_cents),
    proofPath: inv.proof_path,
    revisadoPor: null,
    contactId: inv.contact_id,
    venceEl: inv.vence_el ? new Date(inv.vence_el) : null,
    diasDemo: inv.tipo === "demo" ? Number(inv.dias_demo ?? 2) : null,
  });
  if ("error" in r) {
    console.error("invitacion de registro: no se pudo activar el espacio:", r.error);
    return;
  }
  await admin
    .from("invitaciones_registro")
    .update({ status: "used", used_at: new Date().toISOString(), workspace_id: workspaceId, payment_id: r.paymentId })
    .eq("id", inv.id);

  await avisarCuentaCreada(admin, inv.contact_id, inv.created_by, plan.name, workspaceId, inv.tipo === "demo" ? Number(inv.dias_demo ?? 2) : null);
}

/**
 * Campana del administrador: "Cliente X creó su cuenta", con botón que
 * lleva al chat del contacto en el espacio de soporte (donde nació el enlace).
 */
async function avisarCuentaCreada(
  admin: SupabaseClient,
  contactId: string | null,
  creadoPor: string | null,
  planName: string,
  nuevoWorkspaceId: string,
  diasDemo: number | null
): Promise<void> {
  const { data: nuevo } = await admin.from("workspaces").select("name").eq("id", nuevoWorkspaceId).maybeSingle();

  // Enlace creado desde Admin sin contacto (demo para un prospecto): el
  // aviso va al espacio de quien lo creo y lleva al espacio nuevo.
  if (!contactId) {
    if (!creadoPor) return;
    const { data: miembro } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", creadoPor)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!miembro) return;
    const { error } = await admin.from("notifications").insert({
      title: `"${nuevo?.name ?? "Nuevo espacio"}" creó su cuenta`,
      body: diasDemo ? `Se registró con tu enlace demo: plan ${planName} por ${diasDemo} días.` : `Se registró con tu enlace: plan ${planName}.`,
      scope: "workspace",
      target_workspace_id: miembro.workspace_id,
      cta_label: "Ver espacio",
      cta_url: `/admin/workspaces/${nuevoWorkspaceId}`,
      ends_at: new Date(Date.now() + DIAS_AVISO_CUENTA_CREADA * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) console.error("invitacion de registro: no se pudo crear la notificacion:", error.message);
    return;
  }

  const [{ data: contacto }, { data: conversacion }] = await Promise.all([
    admin.from("contacts").select("workspace_id, name, wa_id").eq("id", contactId).maybeSingle(),
    admin.from("conversations").select("id").eq("contact_id", contactId).order("last_message_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!contacto) return;
  const quien = contacto.name?.trim() || contacto.wa_id;
  const { error } = await admin.from("notifications").insert({
    title: `${quien} creó su cuenta`,
    body: diasDemo
      ? `Se registró con tu enlace demo: espacio "${nuevo?.name ?? "nuevo"}" con plan ${planName} por ${diasDemo} días.`
      : `Se registró con tu enlace: espacio "${nuevo?.name ?? "nuevo"}" activo con plan ${planName}.`,
    scope: "workspace",
    target_workspace_id: contacto.workspace_id,
    cta_label: "Ir a su chat",
    cta_url: conversacion ? `/dashboard/inbox/${conversacion.id}` : "/dashboard/inbox",
    // Aviso de paso: deja de verse a los 3 dias y el trabajo de limpieza lo borra.
    ends_at: new Date(Date.now() + DIAS_AVISO_CUENTA_CREADA * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) console.error("invitacion de registro: no se pudo crear la notificacion:", error.message);
}
