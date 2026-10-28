import type { SupabaseClient } from "@supabase/supabase-js";
import { comisionCents } from "@/lib/vendedores/comision";
import { sendPushToUsers } from "@/lib/push/send";

/**
 * Ventas de los vendedores (migracion 0158). Todo con el cliente de servicio:
 * lo llaman acciones que ya verificaron quien actua.
 */

export type Vendedor = { user_id: string; workspace_id: string; comision_pct: number; activo: boolean };

export async function vendedorActivo(admin: SupabaseClient, userId: string | null | undefined): Promise<Vendedor | null> {
  if (!userId) return null;
  const { data } = await admin
    .from("vendedores")
    .select("user_id, workspace_id, comision_pct, activo")
    .eq("user_id", userId)
    .maybeSingle();
  return data && data.activo ? (data as Vendedor) : null;
}

/** Nombre para mostrar de un usuario (el de su perfil o, si no tiene, su correo). */
export async function nombreDeUsuario(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const meta = data.user?.user_metadata as { full_name?: string } | undefined;
  return meta?.full_name?.trim() || data.user?.email || "Vendedor";
}

/**
 * Anota la venta de un vendedor, deja el chat del cliente a su nombre y le
 * avisa al administrador. Da comision cada licencia NUEVA (cada enlace de
 * registro crea un espacio nuevo: un cliente puede comprar varias). Lo que no
 * da comision es renovar: pagar un espacio que ya habia pagado antes.
 */
export async function registrarVentaDeVendedor(
  admin: SupabaseClient,
  v: Vendedor,
  venta: {
    contactId: string;
    planId: string;
    planNombre: string;
    montoCents: number;
    invitacionId?: string | null;
    clienteWorkspaceId?: string | null;
    paymentId?: string | null;
  }
): Promise<{ anotada: boolean; motivo?: string }> {
  if (venta.clienteWorkspaceId) {
    let pagosPrevios = admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", venta.clienteWorkspaceId)
      .eq("status", "approved")
      .gt("amount_cents", 0);
    if (venta.paymentId) pagosPrevios = pagosPrevios.neq("id", venta.paymentId);
    const { count } = await pagosPrevios;
    if ((count ?? 0) > 0) return { anotada: false, motivo: "Es una renovación: la comisión es solo por la primera venta." };
  }

  const { data: conversaciones } = await admin
    .from("conversations")
    .select("id")
    .eq("workspace_id", v.workspace_id)
    .eq("contact_id", venta.contactId)
    .eq("assigned_agent_id", v.user_id);
  const conversationId = conversaciones?.[0]?.id ?? null;

  const pct = Number(v.comision_pct);
  const { data: creada, error } = await admin
    .from("ventas_vendedor")
    .insert({
      vendedor_id: v.user_id,
      contact_id: venta.contactId,
      conversation_id: conversationId,
      invitacion_id: venta.invitacionId ?? null,
      cliente_workspace_id: venta.clienteWorkspaceId ?? null,
      payment_id: venta.paymentId ?? null,
      plan_id: venta.planId,
      monto_cents: venta.montoCents,
      comision_pct: pct,
      comision_cents: comisionCents(venta.montoCents, pct),
    })
    .select("id")
    .single();
  if (error || !creada) {
    console.error("vendedores: no se pudo anotar la venta", error?.message);
    return { anotada: false, motivo: "No se pudo anotar la comisión." };
  }

  // Candado: los chats de este cliente quedan a nombre del vendedor.
  await admin
    .from("conversations")
    .update({ vendedor_id: v.user_id })
    .eq("workspace_id", v.workspace_id)
    .eq("contact_id", venta.contactId);

  await avisarVentaAlAdministrador(admin, v, venta.contactId, venta.planNombre, venta.montoCents, creada.id as string);
  return { anotada: true };
}

const pesos = (cents: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cents / 100);

/**
 * Aviso de venta nueva: en la campana del espacio (solo dueño y administradores
 * lo ven, no los vendedores) y al celular de los administradores de la
 * plataforma, con boton directo a aprobarla. Nunca lanza.
 */
async function avisarVentaAlAdministrador(
  admin: SupabaseClient,
  v: Vendedor,
  contactId: string,
  planNombre: string,
  montoCents: number,
  ventaId: string
) {
  try {
    const [nombre, { data: contacto }, { data: admins }] = await Promise.all([
      nombreDeUsuario(admin, v.user_id),
      admin.from("contacts").select("name, wa_id").eq("id", contactId).maybeSingle(),
      admin.from("platform_admins").select("user_id"),
    ]);
    const cliente = (contacto?.name as string | null)?.trim() || (contacto?.wa_id as string | undefined) || "un cliente";
    const titulo = `💰 ${nombre} registró una venta`;
    const cuerpo = `Venta de ${pesos(montoCents)} a ${cliente} (plan ${planNombre}). Revisa el comprobante y apruébala.`;
    const url = `/admin/vendedores?venta=${ventaId}`;

    const { error } = await admin.from("notifications").insert({
      title: titulo,
      body: cuerpo,
      scope: "workspace",
      target_workspace_id: v.workspace_id,
      solo_admins: true,
      cta_label: "Aprobar venta",
      cta_url: url,
      ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
    if (error) console.error("vendedores: no se pudo crear el aviso de la campana", error.message);

    const ids = (admins ?? []).map((a) => a.user_id as string);
    if (ids.length) {
      await sendPushToUsers(admin as Parameters<typeof sendPushToUsers>[0], ids, { title: titulo, body: cuerpo, url, tag: `venta-${ventaId}` });
    }
  } catch (err) {
    console.error("vendedores: no se pudo avisar la venta", err);
  }
}
