import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { accesoDeConexion, type Conexion } from "@/lib/integraciones/google/acceso";
import { detenerCanal, leerEvento, listarEventos, suscribirCanal, type EventoDeGoogle } from "@/lib/integraciones/google/calendario";

/**
 * Google -> CRM: lo que el usuario cambia en Google en una cita que creo el CRM
 * vuelve a la Agenda. Gana el ultimo cambio.
 *
 * Desde el 24 nov 2026 tambien se TRAEN a la Agenda las citas creadas en Google
 * (reservas de la pagina de citas de Google, eventos hechos a mano en Gmail):
 * ver `citaDesdeGoogle` e `importarCitasDeGoogle`. Una vez importadas, se
 * sincronizan igual que las del CRM (por su id).
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

/** Lo que se guarda en la Agenda de un evento creado en Google. */
export type CitaDeGoogle = {
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  invitados: string[];
  meet_url: string | null;
  /** Quien reservo (nombre), para mostrarlo si no hay contacto en el CRM. */
  nombre_externo: string | null;
};

/** Texto plano de la descripcion de Google (trae HTML: <b>, <br>). */
function textoPlano(html: string | undefined): string {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Si un evento de Google debe entrar a la Agenda y con que datos. Puro.
 *
 * Solo entran CITAS: reservas de la pagina de citas de Google o eventos con al
 * menos un invitado. Las notas personales del calendario (bloqueos "no dar
 * cita", recordatorios de pagos...) no son citas: no se traen, porque la Agenda
 * la ve el equipo del espacio y cada cita dispara un aviso.
 *
 * Tambien quedan fuera: los cancelados, los de todo el dia (sin hora), los que
 * creo el propio CRM (citas y recordatorios) y aquellos a los que invitaron a
 * la persona pero organiza otro.
 */
export function citaDesdeGoogle(g: EventoDeGoogle): CitaDeGoogle | null {
  if (g.status === "cancelled") return null;
  if (!g.start?.dateTime || !g.end?.dateTime) return null;
  const marcas = { ...(g.extendedProperties?.shared ?? {}), ...(g.extendedProperties?.private ?? {}) };
  if (marcas.crmEventoId || marcas.crmRecordatorioId) return null;
  if (g.organizer && !g.organizer.self) return null;

  const invitados = invitadosDe(g);
  const esReserva = Object.keys(marcas).some((k) => k.startsWith("goo.createdBy"));
  if (!esReserva && invitados.length === 0) return null;
  const descripcion = textoPlano(g.description);
  // Reserva de la pagina de citas de Google: "Reservada por\n<nombre>\n<correo>".
  const reserva = /Reservad[ao] por\s*\n\s*([^\n]+)/i.exec(descripcion);
  const asistente = (g.attendees ?? []).find((a) => !a.self && !a.organizer);
  const nombre = reserva?.[1]?.trim() || asistente?.displayName?.trim() || asistente?.email || null;

  return {
    titulo: (g.summary?.trim() || (nombre ? `Cita con ${nombre}` : "Cita de Google")).replace(/\s+/g, " ").slice(0, 200),
    descripcion: descripcion ? descripcion.slice(0, 2000) : null,
    inicio: new Date(g.start.dateTime).toISOString(),
    fin: new Date(g.end.dateTime).toISOString(),
    invitados,
    meet_url: g.hangoutLink ?? null,
    nombre_externo: nombre ? nombre.slice(0, 120) : null,
  };
}

/** Cuantos dias hacia adelante se traen las citas de Google. */
const DIAS_A_IMPORTAR = 60;

/**
 * Trae a la Agenda los eventos de Google que aun no estan en el CRM. Se intenta
 * ligar cada uno a un contacto por el correo de quien reservo; si no hay, la
 * cita queda igual en la Agenda con el nombre de esa persona.
 */
async function importarCitasDeGoogle(
  supabase: SupabaseClient,
  conexionId: string,
  token: string
): Promise<number> {
  const { data: datos } = await supabase
    .from("integraciones_conexiones")
    .select("workspace_id, user_id")
    .eq("id", conexionId)
    .maybeSingle();
  if (!datos?.workspace_id) return 0;
  const workspaceId = datos.workspace_id as string;

  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const hasta = new Date(Date.now() + DIAS_A_IMPORTAR * 24 * 3_600_000).toISOString();
  const eventos = await listarEventos(token, desde, hasta);
  if (eventos.length === 0) return 0;

  const { data: ya } = await supabase
    .from("agenda_eventos")
    .select("google_event_id")
    .eq("conexion_id", conexionId)
    .in("google_event_id", eventos.map((e) => e.id));
  const conocidos = new Set((ya ?? []).map((r) => r.google_event_id as string));

  let nuevas = 0;
  for (const g of eventos) {
    if (conocidos.has(g.id)) continue;
    const cita = citaDesdeGoogle(g);
    if (!cita) continue;

    let contactId: string | null = null;
    for (const correo of cita.invitados) {
      const { data } = await supabase.rpc("agenda_contacto_por_correo", { p_workspace: workspaceId, p_correo: correo });
      if (data) {
        contactId = data as string;
        break;
      }
    }

    const { error } = await supabase.from("agenda_eventos").insert({
      workspace_id: workspaceId,
      conexion_id: conexionId,
      contact_id: contactId,
      titulo: cita.titulo,
      descripcion: cita.descripcion,
      inicio: cita.inicio,
      fin: cita.fin,
      invitado_email: cita.invitados[0] ?? null,
      invitados: cita.invitados,
      con_meet: !!cita.meet_url,
      meet_url: cita.meet_url,
      google_event_id: g.id,
      google_etag: g.etag ?? null,
      estado: "confirmado",
      origen: "google",
      nombre_externo: cita.nombre_externo,
      // A quien conecto Google le llega el aviso de la reunion, como con las suyas.
      created_by: (datos.user_id as string | null) ?? null,
    });
    // 23505: otra revision (aviso de Google y revision periodica a la vez) ya la trajo.
    if (error && error.code !== "23505") {
      console.error("google calendar: no se pudo traer una cita de Google:", error.message);
      continue;
    }
    if (!error) nuevas += 1;
  }
  return nuevas;
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

    let importadas = 0;
    try {
      importadas = await importarCitasDeGoogle(supabase, conexion.id, acceso.token);
      if (importadas > 0) console.log(`google calendar: ${importadas} cita(s) nuevas traidas de Google`);
    } catch (err) {
      console.error("google calendar: no se pudieron traer las citas de Google:", err instanceof Error ? err.message : err);
    }

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
    return { cambiadas: cambiadas + importadas };
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
