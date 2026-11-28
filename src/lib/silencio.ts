import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Horario de silencio (26 nov 2026, migracion 0192).
 *
 * Cada espacio puede elegir un horario (ej. 22:00 a 05:00, hora de Bogota) en el
 * que el CRM no envia nada POR SU CUENTA: pasos con espera de automatizaciones,
 * seguimientos (de automatizaciones y de la IA), esperas de flujos y campanas de
 * texto. Se mueven al final del silencio; si al retomarse un texto ya no cabe en
 * la ventana de 24 h, no sale. Las plantillas salen normal (no dependen de la
 * ventana).
 *
 * No se frena: lo manual, los mensajes programados por una persona, la API
 * publica, las respuestas de la IA ni lo que responde a un cliente que acaba de
 * escribir (CONVERSACION_ACTIVA_MS): si el cliente esta hablando, la
 * conversacion sigue aunque sea de noche.
 *
 * Bogota no tiene horario de verano: siempre UTC-5.
 */

export type HorarioDeSilencio = { activo: boolean; inicio: string; fin: string };

const DESFASE_BOGOTA_MIN = -5 * 60;
const DIA_MIN = 24 * 60;
/** Si el cliente escribio hace menos de esto, la conversacion esta "activa" y nada se frena. */
export const CONVERSACION_ACTIVA_MS = 30 * 60 * 1000;
const VENTANA_MS = 24 * 60 * 60 * 1000;

/** "22:00" -> 1320. null si el formato no es HH:MM valido. */
export function aMinutos(hhmm: string | null | undefined): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((hhmm ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minuto del dia en Bogota (0..1439). */
export function minutoEnBogota(fecha: Date): number {
  const utc = fecha.getUTCHours() * 60 + fecha.getUTCMinutes();
  return (((utc + DESFASE_BOGOTA_MIN) % DIA_MIN) + DIA_MIN) % DIA_MIN;
}

function rango(h: HorarioDeSilencio | null | undefined): { inicio: number; fin: number } | null {
  if (!h?.activo) return null;
  const inicio = aMinutos(h.inicio);
  const fin = aMinutos(h.fin);
  if (inicio === null || fin === null || inicio === fin) return null;
  return { inicio, fin };
}

/** ¿Este momento cae dentro del horario de silencio? Acepta horarios que cruzan la medianoche. */
export function enSilencio(h: HorarioDeSilencio | null | undefined, fecha: Date): boolean {
  const r = rango(h);
  if (!r) return false;
  const m = minutoEnBogota(fecha);
  return r.inicio < r.fin ? m >= r.inicio && m < r.fin : m >= r.inicio || m < r.fin;
}

/** Cuando termina el silencio en curso (o el proximo fin, si no hay silencio). */
export function finDelSilencio(h: HorarioDeSilencio, fecha: Date): Date {
  const r = rango(h);
  if (!r) return fecha;
  const m = minutoEnBogota(fecha);
  let faltan = r.fin - m;
  if (faltan <= 0) faltan += DIA_MIN;
  const fin = new Date(fecha.getTime() + faltan * 60_000);
  fin.setUTCSeconds(0, 0);
  return fin;
}

/** El cliente escribio hace poco: la conversacion sigue aunque sea horario de silencio. */
export function conversacionActiva(ultimoEntranteIso: string | null | undefined, ahora: Date): boolean {
  if (!ultimoEntranteIso) return false;
  return ahora.getTime() - new Date(ultimoEntranteIso).getTime() < CONVERSACION_ACTIVA_MS;
}

/** La ventana de 24 h de WhatsApp sigue abierta. */
export function ventanaAbierta(ultimoEntranteIso: string | null | undefined, ahora: Date): boolean {
  if (!ultimoEntranteIso) return false;
  return ahora.getTime() - new Date(ultimoEntranteIso).getTime() < VENTANA_MS;
}

/** Horario de silencio de varios espacios, en una consulta. Solo devuelve los que lo tienen activo. */
export async function horariosDeSilencio(
  supabase: SupabaseClient,
  workspaceIds: string[]
): Promise<Map<string, HorarioDeSilencio>> {
  const ids = [...new Set(workspaceIds.filter(Boolean))];
  const mapa = new Map<string, HorarioDeSilencio>();
  if (ids.length === 0) return mapa;
  // Si la lectura falla, se sigue como sin silencio: un problema aqui no debe
  // frenar los envios de nadie.
  try {
    const { data } = await supabase
      .from("workspaces")
      .select("id, silencio_activo, silencio_inicio, silencio_fin")
      .in("id", ids)
      .eq("silencio_activo", true);
    for (const w of data ?? []) {
      mapa.set(w.id as string, { activo: true, inicio: w.silencio_inicio as string, fin: w.silencio_fin as string });
    }
  } catch (err) {
    console.error("horario de silencio: no se pudo leer:", err instanceof Error ? err.message : err);
  }
  return mapa;
}

/** Ultimo mensaje que escribio el contacto (en cualquiera de sus chats del espacio). */
export async function ultimoEntranteDelContacto(supabase: SupabaseClient, contactId: string): Promise<string | null> {
  const { data } = await supabase
    .from("messages")
    .select("created_at, conversations!inner(contact_id)")
    .eq("conversations.contact_id", contactId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

/** Ultimo mensaje que escribio el cliente en una conversacion. */
export async function ultimoEntranteDeConversacion(supabase: SupabaseClient, conversationId: string): Promise<string | null> {
  const { data } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}
