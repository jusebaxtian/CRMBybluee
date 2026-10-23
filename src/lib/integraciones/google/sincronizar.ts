import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { accesoDeConexion, type Conexion } from "@/lib/integraciones/google/acceso";
import { detenerCanal, leerEvento, suscribirCanal, type EventoDeGoogle } from "@/lib/integraciones/google/calendario";

/**
 * Google -> CRM: lo que el usuario cambia en Google en una cita que creo el CRM
 * vuelve a la Agenda. Gana el ultimo cambio. Los eventos de Google que no son del
 * CRM no se leen: se consulta cada cita nuestra por su id.
 */

export type FilaDeCita = {
  id: string;
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  invitado_email: string | null;
  invitados?: string[];
  meet_url: string | null;
  estado: string;
  updated_at: string;
  google_etag: string | null;
};

export type Cambios = Partial<{
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  invitado_email: string | null;
  invitados: string[];
  meet_url: string;
  estado: "cancelado";
  cancelado_desde: "google";
}>;

const mismaHora = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

/** Los correos invitados que puso el CRM: todos menos la propia persona y el organizador. */
function invitadosDe(g: EventoDeGoogle): string[] {
  return (g.attendees ?? []).filter((a) => !a.self && !a.organizer && a.email).map((a) => a.email.toLowerCase());
}

/** Correos de quien organiza el evento en Google (puede coincidir con uno de la cita del CRM). */
function propiosDe(g: EventoDeGoogle): Set<string> {
  return new Set((g.attendees ?? []).filter((a) => (a.self || a.organizer) && a.email).map((a) => a.email.toLowerCase()));
}

/**
 * Que cambia en la cita del CRM a partir de lo que hay ahora en Google. Puro.
 * Devuelve {} si no hay nada que cambiar. Si el cambio mas reciente es el del CRM,
 * no se pisa con lo viejo de Google.
 */
export function cambiosDesdeGoogle(cita: FilaDeCita, g: EventoDeGoogle): Cambios {
  if (cita.estado === "cancelado") return {};

  if (g.status === "cancelled") return { estado: "cancelado", cancelado_desde: "google" };

  // El cambio mas reciente gana: si la cita se edito en el CRM despues de la
  // ultima actualizacion de Google, lo de Google es lo viejo.
  if (g.updated && new Date(g.updated).getTime() <= new Date(cita.updated_at).getTime()) return {};

  const cambios: Cambios = {};
  const titulo = g.summary?.trim();
  if (titulo && titulo !== cita.titulo) cambios.titulo = titulo.slice(0, 200);

  // Un evento convertido a "todo el dia" no tiene hora: se deja como esta.
  if (g.start?.dateTime && g.end?.dateTime) {
    if (!mismaHora(g.start.dateTime, cita.inicio)) cambios.inicio = new Date(g.start.dateTime).toISOString();
    if (!mismaHora(g.end.dateTime, cita.fin)) cambios.fin = new Date(g.end.dateTime).toISOString();
  }

  const descripcion = g.description?.trim() || null;
  if (descripcion !== (cita.descripcion ?? null)) cambios.descripcion = descripcion?.slice(0, 2000) ?? null;

  // Se compara sin el organizador: si el correo de la cuenta va en la cita, Google lo muestra como
  // organizador y no como invitado, y no se debe tomar por un invitado que alguien quitó.
  const propios = propiosDe(g);
  const delCrm = (cita.invitados?.length ? cita.invitados : cita.invitado_email ? [cita.invitado_email] : [])
    .map((c) => c.toLowerCase())
    .filter((c) => !propios.has(c));
  const deGoogle = invitadosDe(g);
  const igualesInv = delCrm.length === deGoogle.length && delCrm.every((c) => deGoogle.includes(c));
  if (!igualesInv) {
    // Los del organizador que ya estaban en la cita se conservan en el CRM.
    const conservados = (cita.invitados ?? []).filter((c) => propios.has(c.toLowerCase()));
    cambios.invitados = [...conservados, ...deGoogle];
    cambios.invitado_email = cambios.invitados[0] ?? null;
  }

  if (g.hangoutLink && g.hangoutLink !== cita.meet_url) cambios.meet_url = g.hangoutLink;
  return cambios;
}

const enCurso = new Set<string>();

/**
 * Revisa las citas de una conexion contra Google y aplica lo que cambio. Con
 * `If-None-Match` lo que no cambio sale en una respuesta vacia.
 */
export async function sincronizarConexion(supabase: SupabaseClient, conexion: Conexion): Promise<{ cambiadas: number }> {
  if (enCurso.has(conexion.id)) return { cambiadas: 0 };
  enCurso.add(conexion.id);
  try {
    const acceso = await accesoDeConexion(conexion);
    if ("error" in acceso) return { cambiadas: 0 };

    const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data: citas } = await supabase
      .from("agenda_eventos")
      .select("id, titulo, descripcion, inicio, fin, invitado_email, invitados, meet_url, estado, updated_at, google_etag, google_event_id")
      .eq("conexion_id", conexion.id)
      .eq("estado", "confirmado")
      .not("google_event_id", "is", null)
      .gte("fin", desde)
      .order("inicio")
      .limit(100);

    let cambiadas = 0;
    for (const c of citas ?? []) {
      try {
        const leido = await leerEvento(acceso.token, c.google_event_id as string, (c.google_etag as string | null) ?? undefined);
        if (leido.tipo === "sin_cambios") continue;

        const cita = c as unknown as FilaDeCita;
        if (leido.tipo === "borrado") {
          await supabase.from("agenda_eventos").update({ estado: "cancelado", cancelado_desde: "google", updated_at: new Date().toISOString() }).eq("id", cita.id);
          cambiadas += 1;
          continue;
        }

        const cambios = cambiosDesdeGoogle(cita, leido.evento);
        const hay = Object.keys(cambios).length > 0;
        await supabase
          .from("agenda_eventos")
          .update({ ...cambios, google_etag: leido.evento.etag ?? null, ...(hay ? { updated_at: new Date().toISOString() } : {}) })
          .eq("id", cita.id);
        if (hay) cambiadas += 1;
      } catch (err) {
        console.error("google calendar: no se pudo revisar una cita:", err instanceof Error ? err.message : err);
      }
    }
    return { cambiadas };
  } finally {
    enCurso.delete(conexion.id);
  }
}

const RENOVAR_ANTES_MS = 24 * 3_600_000;

/**
 * Trabajo de fondo: mantiene el canal de avisos de Google de cada conexion
 * (se crea y se renueva solo; si Google no lo permite, queda el respaldo) y
 * revisa las citas.
 */
export async function sincronizarGoogleCalendar(): Promise<void> {
  const supabase = createAdminClient();
  const { data: conexiones } = await supabase
    .from("integraciones_conexiones")
    .select("id, token_cifrado, estado, canal_id, canal_recurso_id, canal_expira")
    .eq("proveedor", "google_calendar")
    .eq("estado", "conectado");

  const direccion = process.env.GOOGLE_CALENDAR_AVISO_URL;
  let cambiadas = 0;

  for (const c of conexiones ?? []) {
    const conexion = c as Conexion & { canal_id: string | null; canal_recurso_id: string | null; canal_expira: string | null };
    const vence = conexion.canal_expira ? new Date(conexion.canal_expira).getTime() : 0;

    if (direccion && (!conexion.canal_id || vence < Date.now() + RENOVAR_ANTES_MS)) {
      const acceso = await accesoDeConexion(conexion);
      if (!("error" in acceso)) {
        try {
          const id = `crm-${randomBytes(12).toString("hex")}`;
          const secreto = randomBytes(24).toString("hex");
          const canal = await suscribirCanal(acceso.token, { id, address: direccion, token: secreto });
          await supabase
            .from("integraciones_conexiones")
            .update({ canal_id: id, canal_recurso_id: canal.resourceId, canal_expira: new Date(canal.expiration).toISOString(), canal_secreto: secreto })
            .eq("id", conexion.id);
          // El canal viejo ya no hace falta.
          if (conexion.canal_id && conexion.canal_recurso_id) await detenerCanal(acceso.token, conexion.canal_id, conexion.canal_recurso_id).catch(() => undefined);
        } catch (err) {
          // Sin dominio verificado en Google u otro motivo: se sigue con la revision periodica.
          console.warn("google calendar: no se pudo abrir el canal de avisos:", err instanceof Error ? err.message : err);
        }
      }
    }

    cambiadas += (await sincronizarConexion(supabase, conexion)).cambiadas;
  }
  if (cambiadas > 0) console.log(`google calendar: ${cambiadas} cita(s) actualizadas desde Google`);
}
