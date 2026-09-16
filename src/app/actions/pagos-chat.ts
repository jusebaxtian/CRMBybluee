"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import {
  activarEspacioConPago,
  copiarComprobante,
  nuevoTokenInvitacion,
  type PlanBasico,
} from "@/lib/billing/pagos-chat";

/**
 * Registrar un pago desde un mensaje del chat de soporte (solo administrador).
 */

type Admin = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string | null };

async function soloAdmin(): Promise<{ error: string } | Admin> {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

async function origenPublico(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "crmbybluee.blue";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type ContextoPago = {
  contacto: { id: string; nombre: string; wa_id: string };
  espacio: { id: string; nombre: string; plan: string | null; vence: string | null } | null;
  planes: PlanBasico[];
  tieneAdjunto: boolean;
};

/** Datos para el formulario: contacto del mensaje, espacio (si ya tiene) y planes. */
export async function contextoPagoDesdeChat(messageId: string): Promise<{ error: string } | ContextoPago> {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const { supabase } = a;

  const { data: msg } = await supabase
    .from("messages")
    .select("id, media_url, conversations!inner(contact_id, contacts(id, name, wa_id))")
    .eq("id", messageId)
    .maybeSingle();
  const conv = msg?.conversations as unknown as { contact_id: string; contacts: { id: string; name: string | null; wa_id: string } } | null;
  if (!msg || !conv?.contacts) return { error: "Mensaje no encontrado." };

  const [{ data: espacios }, { data: planes }] = await Promise.all([
    supabase.rpc("admin_espacio_de_contacto", { p_contact_id: conv.contacts.id }),
    supabase.from("plans").select("id, name, price_cents, currency, billing_cycle").eq("is_active", true).order("price_cents"),
  ]);
  const e = ((espacios ?? []) as { workspace_id: string; workspace_name: string; plan_name: string | null; vence: string | null }[])[0];

  return {
    contacto: { id: conv.contacts.id, nombre: conv.contacts.name?.trim() || conv.contacts.wa_id, wa_id: conv.contacts.wa_id },
    espacio: e ? { id: e.workspace_id, nombre: e.workspace_name, plan: e.plan_name, vence: e.vence } : null,
    planes: (planes ?? []) as PlanBasico[],
    tieneAdjunto: !!msg.media_url,
  };
}

export async function registrarPagoDesdeChat(input: {
  messageId: string;
  workspaceId: string | null;
  planId: string;
  amount: string;
  nota?: string;
}): Promise<{ error: string } | { tipo: "activado"; espacio: string } | { tipo: "invitacion"; enlace: string }> {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const { supabase, userId } = a;
  const admin = createAdminClient();

  const amountCents = Math.round(Number(String(input.amount).replace(/[^\d.,]/g, "").replace(",", ".")) * 100);
  if (!amountCents || amountCents <= 0) return { error: "Escribe el monto pagado." };

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, billing_cycle")
    .eq("id", input.planId)
    .maybeSingle();
  if (!plan) return { error: "Elige un plan." };

  const { data: msg } = await supabase
    .from("messages")
    .select("id, media_url, conversations!inner(contact_id, contacts(id, wa_id))")
    .eq("id", input.messageId)
    .maybeSingle();
  const conv = msg?.conversations as unknown as { contact_id: string; contacts: { id: string; wa_id: string } } | null;
  if (!msg || !conv?.contacts) return { error: "Mensaje no encontrado." };

  const proofPath = await copiarComprobante(admin, msg.media_url);

  if (input.workspaceId) {
    const r = await activarEspacioConPago(admin, {
      workspaceId: input.workspaceId,
      plan: plan as PlanBasico,
      amountCents,
      proofPath,
      revisadoPor: userId,
      contactId: conv.contacts.id,
    });
    if ("error" in r) return { error: r.error };
    const { data: ws } = await admin.from("workspaces").select("name").eq("id", input.workspaceId).maybeSingle();
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    return { tipo: "activado", espacio: ws?.name ?? "el espacio" };
  }

  const token = nuevoTokenInvitacion();
  const { error } = await admin.from("invitaciones_registro").insert({
    token,
    contact_id: conv.contacts.id,
    phone: conv.contacts.wa_id,
    plan_id: plan.id,
    amount_cents: amountCents,
    currency: plan.currency || "COP",
    proof_path: proofPath,
    nota: input.nota?.trim() || null,
    created_by: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/payments");
  return { tipo: "invitacion", enlace: `${await origenPublico()}/signup?i=${token}` };
}

/** Invitaciones pendientes (Admin → Pagos). */
export async function cancelarInvitacionRegistro(id: string) {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const admin = createAdminClient();
  await admin.from("invitaciones_registro").update({ status: "canceled" }).eq("id", id).eq("status", "pending");
  revalidatePath("/admin/payments");
  return { success: true };
}

/** Lo que ve quien abre el enlace de registro (sin sesion). */
export async function leerInvitacionRegistro(token: string) {
  if (!token || token.length > 64) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invitacion_registro_publica", { p_token: token });
  const fila = ((data ?? []) as { phone: string; plan_name: string; amount_cents: number; currency: string }[])[0];
  return fila ?? null;
}
