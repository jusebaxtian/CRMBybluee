"use server";

import { revalidatePath } from "next/cache";
import { origenPublico } from "@/lib/http/origen-publico";
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
 * Registrar un pago o una demo desde el chat de soporte, y enlaces de
 * registro (con pago o demo) desde Admin (solo administrador).
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

export type ContextoPago = {
  contacto: { id: string; nombre: string; wa_id: string };
  espacio: { id: string; nombre: string; plan: string | null; vence: string | null } | null;
  planes: PlanBasico[];
  tieneAdjunto: boolean;
};

type Contacto = { id: string; name: string | null; wa_id: string };

/** Contacto (y adjunto) a partir del mensaje o del contacto directamente. */
async function resolverContacto(
  supabase: Admin["supabase"],
  input: { messageId?: string | null; contactId?: string | null }
): Promise<{ contacto: Contacto; mediaUrl: string | null } | null> {
  if (input.messageId) {
    const { data: msg } = await supabase
      .from("messages")
      .select("id, media_url, conversations!inner(contact_id, contacts(id, name, wa_id))")
      .eq("id", input.messageId)
      .maybeSingle();
    const conv = msg?.conversations as unknown as { contacts: Contacto | null } | null;
    if (!msg || !conv?.contacts) return null;
    return { contacto: conv.contacts, mediaUrl: msg.media_url };
  }
  if (input.contactId) {
    const { data } = await supabase.from("contacts").select("id, name, wa_id").eq("id", input.contactId).maybeSingle();
    return data ? { contacto: data, mediaUrl: null } : null;
  }
  return null;
}

async function planesActivos(supabase: Admin["supabase"]): Promise<PlanBasico[]> {
  const { data } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, billing_cycle")
    .eq("is_active", true)
    .order("price_cents");
  return (data ?? []) as PlanBasico[];
}

/** Datos para el formulario: contacto, espacio (si ya tiene) y planes. */
export async function contextoPagoDesdeChat(input: {
  messageId?: string | null;
  contactId?: string | null;
}): Promise<{ error: string } | ContextoPago> {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const { supabase } = a;

  const r = await resolverContacto(supabase, input);
  if (!r) return { error: "Contacto no encontrado." };

  const [{ data: espacios }, planes] = await Promise.all([
    supabase.rpc("admin_espacio_de_contacto", { p_contact_id: r.contacto.id }),
    planesActivos(supabase),
  ]);
  const e = ((espacios ?? []) as { workspace_id: string; workspace_name: string; plan_name: string | null; vence: string | null }[])[0];

  return {
    contacto: { id: r.contacto.id, nombre: r.contacto.name?.trim() || r.contacto.wa_id, wa_id: r.contacto.wa_id },
    espacio: e ? { id: e.workspace_id, nombre: e.workspace_name, plan: e.plan_name, vence: e.vence } : null,
    planes,
    tieneAdjunto: !!r.mediaUrl,
  };
}

/** Planes activos para el formulario de enlace demo en Admin. */
export async function planesParaEnlace(): Promise<PlanBasico[]> {
  const a = await soloAdmin();
  if ("error" in a) return [];
  return planesActivos(a.supabase);
}

type Resultado = { error: string } | { tipo: "activado"; espacio: string } | { tipo: "invitacion"; enlace: string };

export async function registrarPagoDesdeChat(input: {
  messageId?: string | null;
  contactId?: string | null;
  workspaceId: string | null;
  planId: string;
  /** "pago" (con monto) o "demo" (sin pago, N dias). */
  modo?: "pago" | "demo";
  amount?: string;
  diasDemo?: number;
  nota?: string;
  /** Fecha de vencimiento (AAAA-MM-DD) elegida por soporte; vacio = ciclo del plan. */
  venceEl?: string;
}): Promise<Resultado> {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const { supabase, userId } = a;
  const admin = createAdminClient();
  const esDemo = input.modo === "demo";

  let amountCents = 0;
  let diasDemo: number | null = null;
  if (esDemo) {
    diasDemo = Math.round(Number(input.diasDemo));
    if (!diasDemo || diasDemo < 1 || diasDemo > 365) return { error: "Los días de demo deben estar entre 1 y 365." };
  } else {
    amountCents = Math.round(Number(String(input.amount ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) * 100);
    if (!amountCents || amountCents <= 0) return { error: "Escribe el monto pagado." };
  }

  let venceEl: Date | null = null;
  if (!esDemo && input.venceEl) {
    // Fin del dia en Colombia, para que "vence el 15" cubra todo el 15.
    venceEl = new Date(`${input.venceEl}T23:59:59-05:00`);
    if (Number.isNaN(venceEl.getTime())) return { error: "La fecha de vencimiento no es válida." };
    if (venceEl.getTime() < Date.now()) return { error: "La fecha de vencimiento ya pasó." };
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, price_cents, currency, billing_cycle")
    .eq("id", input.planId)
    .maybeSingle();
  if (!plan) return { error: "Elige un plan." };

  const r = await resolverContacto(supabase, input);
  if (!r) return { error: "Contacto no encontrado." };

  const proofPath = esDemo ? null : await copiarComprobante(admin, r.mediaUrl);

  if (input.workspaceId) {
    const res = await activarEspacioConPago(admin, {
      workspaceId: input.workspaceId,
      plan: plan as PlanBasico,
      amountCents,
      proofPath,
      revisadoPor: userId,
      contactId: r.contacto.id,
      venceEl,
      diasDemo,
    });
    if ("error" in res) return { error: res.error };
    const { data: ws } = await admin.from("workspaces").select("name").eq("id", input.workspaceId).maybeSingle();
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    return { tipo: "activado", espacio: ws?.name ?? "el espacio" };
  }

  const token = nuevoTokenInvitacion();
  const { error } = await admin.from("invitaciones_registro").insert({
    token,
    contact_id: r.contacto.id,
    phone: r.contacto.wa_id,
    plan_id: plan.id,
    amount_cents: amountCents,
    currency: plan.currency || "COP",
    proof_path: proofPath,
    nota: input.nota?.trim() || null,
    vence_el: venceEl?.toISOString() ?? null,
    tipo: esDemo ? "demo" : "pago",
    dias_demo: diasDemo,
    created_by: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/payments");
  return { tipo: "invitacion", enlace: `${await origenPublico()}/signup?i=${token}` };
}

/** Admin → Pagos: enlace demo sin contacto (para prospectos que aun no escriben al chat). */
export async function crearEnlaceDemo(input: { planId: string; diasDemo: number; nombre?: string }) {
  const a = await soloAdmin();
  if ("error" in a) return { error: a.error };
  const { supabase, userId } = a;
  const dias = Math.round(Number(input.diasDemo));
  if (!dias || dias < 1 || dias > 365) return { error: "Los días de demo deben estar entre 1 y 365." };
  const { data: plan } = await supabase.from("plans").select("id, currency").eq("id", input.planId).maybeSingle();
  if (!plan) return { error: "Elige un plan." };

  const token = nuevoTokenInvitacion();
  const { error } = await createAdminClient().from("invitaciones_registro").insert({
    token,
    plan_id: plan.id,
    amount_cents: 0,
    currency: plan.currency || "COP",
    tipo: "demo",
    dias_demo: dias,
    nombre: input.nombre?.trim() || null,
    created_by: userId,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/payments");
  return { enlace: `${await origenPublico()}/signup?i=${token}` };
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
  const fila = (
    (data ?? []) as { phone: string | null; plan_name: string; amount_cents: number; currency: string; tipo: "pago" | "demo"; dias_demo: number | null }[]
  )[0];
  return fila ?? null;
}
