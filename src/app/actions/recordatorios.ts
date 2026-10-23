"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { abrirConversacion } from "@/lib/whatsapp/conversacion";
import { createClient } from "@/lib/supabase/server";
import { getEnabledModuleKeys } from "@/lib/entitlements";
import { conexionDelUsuario } from "@/lib/integraciones/google/acceso";
import { borrarRecordatorioEnGoogle, crearRecordatorioEnGoogle, moverRecordatorioEnGoogle } from "@/lib/agenda/recordatorio-google";

/**
 * Recordatorios por contacto (migracion 0110): se programan desde el chat
 * y, al vencer, el trabajo de fondo los convierte en aviso de la campana.
 */

/** ¿Puede esta persona agregar recordatorios a su Google Calendar? (modulo en el plan y conexion activa) */
export async function googleListoParaRecordatorios(): Promise<boolean> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return false;
  const { data: { user } } = await ctx.supabase.auth.getUser();
  if (!user) return false;
  if (!(await getEnabledModuleKeys(ctx.supabase, ctx.workspaceId)).includes("google_calendar")) return false;
  const conexion = await conexionDelUsuario(user.id);
  return conexion?.estado === "conectado";
}

export type ResultadoRecordatorio =
  | { error: string; success?: undefined; aviso?: undefined }
  | { success: true; aviso?: string; error?: undefined };

export async function crearRecordatorio(input: { conversationId: string; texto: string; recordarEn: string; enGoogle?: boolean }): Promise<ResultadoRecordatorio> {
  const texto = input.texto.trim();
  if (!texto) return { error: "Escribe qué quieres recordar." };
  if (texto.length > 200) return { error: "Máximo 200 caracteres." };
  const cuando = new Date(input.recordarEn);
  if (Number.isNaN(cuando.getTime())) return { error: "Elige fecha y hora." };
  if (cuando.getTime() < Date.now() + 60_000) return { error: "La fecha debe ser al menos un minuto en el futuro." };

  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, contact_id, contacts(name, wa_id)")
    .eq("id", input.conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!conv) return { error: "Conversación no encontrada." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: creado, error } = await supabase
    .from("recordatorios")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conv.id,
      contact_id: conv.contact_id,
      texto,
      recordar_en: cuando.toISOString(),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !creado) return { error: error?.message ?? "No se pudo guardar." };

  const contacto = conv.contacts as unknown as { name: string | null; wa_id: string } | null;
  const aviso = await agregarAGoogle(supabase, user?.id, input.enGoogle, {
    recordatorioId: creado.id as string,
    texto,
    contacto: contacto?.name?.trim() || contacto?.wa_id || "Contacto",
    conversationId: conv.id as string,
    inicioIso: cuando.toISOString(),
  });

  revalidatePath(`/dashboard/inbox/${conv.id}`);
  return { success: true as const, aviso };
}

export async function eliminarRecordatorio(id: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;
  const { data } = await supabase
    .from("recordatorios")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("conversation_id, google_event_id, conexion_id")
    .maybeSingle();
  if (data) {
    if (data.google_event_id && data.conexion_id) await borrarRecordatorioEnGoogle(data.conexion_id as string, data.google_event_id as string);
    revalidatePath(`/dashboard/inbox/${data.conversation_id}`);
  }
  return { success: true as const };
}

export async function listarRecordatorios(conversationId: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return [];
  const { supabase, workspaceId } = ctx;
  const { data } = await supabase
    .from("recordatorios")
    .select("id, texto, recordar_en")
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .is("avisado_en", null)
    .order("recordar_en");
  return (data ?? []) as { id: string; texto: string; recordar_en: string }[];
}

/**
 * Si la persona lo pidio, crea el evento en su Google Calendar y guarda el enlace.
 * Devuelve un aviso (no un error) cuando Google falla: el recordatorio del CRM ya existe.
 */
async function agregarAGoogle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | undefined,
  quiere: boolean | undefined,
  d: { recordatorioId: string; texto: string; contacto: string; conversationId: string; inicioIso: string }
): Promise<string | undefined> {
  if (!quiere || !userId) return undefined;
  const r = await crearRecordatorioEnGoogle(userId, d);
  if ("aviso" in r) return r.aviso;
  await supabase.from("recordatorios").update({ google_event_id: r.eventId, conexion_id: r.conexionId }).eq("id", d.recordatorioId);
  return undefined;
}

function validar(texto: string, recordarEn: string): { error: string } | { texto: string; cuando: Date } {
  const t = texto.trim();
  if (!t) return { error: "Escribe qué quieres recordar." };
  if (t.length > 200) return { error: "Máximo 200 caracteres." };
  const cuando = new Date(recordarEn);
  if (Number.isNaN(cuando.getTime())) return { error: "Elige fecha y hora." };
  if (cuando.getTime() < Date.now() + 60_000) return { error: "La fecha debe ser al menos un minuto en el futuro." };
  return { texto: t, cuando };
}

export async function actualizarRecordatorio(input: { id: string; texto: string; recordarEn: string }) {
  const v = validar(input.texto, input.recordarEn);
  if ("error" in v) return { error: v.error };
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;
  const { data, error } = await supabase
    .from("recordatorios")
    .update({ texto: v.texto, recordar_en: v.cuando.toISOString(), avisado_en: null })
    .eq("id", input.id)
    .eq("workspace_id", workspaceId)
    .select("conversation_id, google_event_id, conexion_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Recordatorio no encontrado (quizá ya se cumplió)." };
  if (data.google_event_id && data.conexion_id) {
    await moverRecordatorioEnGoogle(data.conexion_id as string, data.google_event_id as string, { texto: v.texto, inicioIso: v.cuando.toISOString() });
  }
  revalidatePath(`/dashboard/inbox/${data.conversation_id}`);
  revalidatePath("/dashboard/agenda");
  return { success: true as const };
}

export type RecordatorioAgenda = {
  id: string;
  texto: string;
  recordar_en: string;
  conversation_id: string;
  contacto: string;
  wa_id: string;
  /** Cuando ya sono el aviso (historial); null = pendiente. */
  avisado_en: string | null;
};

/** Recordatorios del espacio entre dos fechas (Agenda). */
export async function listarRecordatoriosEntre(desdeIso: string, hastaIso: string): Promise<RecordatorioAgenda[]> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return [];
  const { supabase, workspaceId } = ctx;
  const { data } = await supabase
    .from("recordatorios")
    .select("id, texto, recordar_en, conversation_id, avisado_en, contacts(name, wa_id)")
    .eq("workspace_id", workspaceId)
    .gte("recordar_en", desdeIso)
    .lt("recordar_en", hastaIso)
    .order("recordar_en");
  return (data ?? []).map((r) => {
    const c = r.contacts as unknown as { name: string | null; wa_id: string } | null;
    return {
      id: r.id,
      texto: r.texto,
      recordar_en: r.recordar_en,
      conversation_id: r.conversation_id,
      contacto: c?.name?.trim() || c?.wa_id || "Contacto",
      wa_id: c?.wa_id ?? "",
      avisado_en: (r.avisado_en as string | null) ?? null,
    };
  });
}

/** Busqueda de contactos para crear un recordatorio desde la Agenda. */
export async function buscarContactosParaRecordatorio(q: string) {
  const termino = q.trim();
  if (termino.length < 2) return [];
  const ctx = await requireWorkspace();
  if ("error" in ctx) return [];
  const { supabase, workspaceId } = ctx;
  const patron = `%${termino.replace(/[%_]/g, "")}%`;
  const { data } = await supabase
    .from("contacts")
    .select("id, name, wa_id")
    .eq("workspace_id", workspaceId)
    .or(`name.ilike.${patron},wa_id.ilike.${patron}`)
    .order("name")
    .limit(8);
  return (data ?? []).map((c) => ({ id: c.id, nombre: c.name?.trim() || c.wa_id, wa_id: c.wa_id }));
}

/** Crear desde la Agenda: abre (o reutiliza) el chat del contacto y programa. */
export async function crearRecordatorioParaContacto(input: { contactId: string; texto: string; recordarEn: string; enGoogle?: boolean }): Promise<ResultadoRecordatorio> {
  const v = validar(input.texto, input.recordarEn);
  if ("error" in v) return { error: v.error };
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;
  const conversacion = await abrirConversacion(supabase, workspaceId, input.contactId);
  if (!conversacion) return { error: "No se pudo abrir el chat del contacto." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: creado, error } = await supabase
    .from("recordatorios")
    .insert({
      workspace_id: workspaceId,
      conversation_id: conversacion.id,
      contact_id: input.contactId,
      texto: v.texto,
      recordar_en: v.cuando.toISOString(),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !creado) return { error: error?.message ?? "No se pudo guardar." };

  const { data: contacto } = await supabase.from("contacts").select("name, wa_id").eq("id", input.contactId).maybeSingle();
  const aviso = await agregarAGoogle(supabase, user?.id, input.enGoogle, {
    recordatorioId: creado.id as string,
    texto: v.texto,
    contacto: contacto?.name?.trim() || contacto?.wa_id || "Contacto",
    conversationId: conversacion.id,
    inicioIso: v.cuando.toISOString(),
  });
  revalidatePath("/dashboard/agenda");
  return { success: true as const, aviso };
}
