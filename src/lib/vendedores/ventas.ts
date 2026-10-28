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
 * avisa al administrador. Solo la PRIMERA venta de un cliente da comision: si
 * el contacto ya tiene una venta vigente, o el espacio ya habia pagado antes
 * (es una renovacion), no se anota nada.
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
  const { data: previa } = await admin
    .from("ventas_vendedor")
    .select("id")
    .eq("contact_id", venta.contactId)
    .neq("estado", "anulada")
    .limit(1)
    .maybeSingle();
  if (previa) return { anotada: false, motivo: "Este cliente ya tiene una venta registrada." };

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

  await avisarVentaAlAdministrador(admin, v.user_id, venta.planNombre, venta.montoCents, creada.id as string);
  return { anotada: true };
}

const pesos = (cents: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(cents / 100);

/** Notificacion al celular de los administradores de la plataforma. Nunca lanza. */
async function avisarVentaAlAdministrador(admin: SupabaseClient, vendedorId: string, planNombre: string, montoCents: number, ventaId: string) {
  try {
    const { data: admins } = await admin.from("platform_admins").select("user_id");
    const ids = (admins ?? []).map((a) => a.user_id as string);
    if (!ids.length) return;
    const nombre = await nombreDeUsuario(admin, vendedorId);
    await sendPushToUsers(admin as Parameters<typeof sendPushToUsers>[0], ids, {
      title: "💰 Nueva venta por aprobar",
      body: `${nombre} vendió ${planNombre} por ${pesos(montoCents)}. Revisa el comprobante y apruébala.`,
      url: "/admin/vendedores",
      tag: `venta-${ventaId}`,
    });
  } catch (err) {
    console.error("vendedores: no se pudo avisar la venta", err);
  }
}
