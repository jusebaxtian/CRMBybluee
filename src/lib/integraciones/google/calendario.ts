/**
 * Cliente minimo de Google Calendar para la Agenda del CRM.
 *
 * Solo toca el calendario PRINCIPAL del usuario y solo los eventos que el CRM
 * creo (cada uno lleva una marca privada con el id del evento en el CRM).
 * No toca la base: recibe el token de acceso ya listo. Lo puro (el cuerpo del
 * evento, el calculo de choques) se prueba sin red.
 */

const API = "https://www.googleapis.com/calendar/v3";
export const ZONA_HORARIA = "America/Bogota";

export class ConexionVencidaError extends Error {
  constructor() {
    super("La conexión con Google venció.");
  }
}

export type DatosDeEvento = {
  crmEventoId: string;
  titulo: string;
  descripcion?: string | null;
  inicioIso: string;
  finIso: string;
  invitadoEmail?: string | null;
  /** Todos los invitados. Si falta, se usa `invitadoEmail`. */
  invitadosEmails?: string[];
  conMeet: boolean;
};

function invitadosDe(d: Pick<DatosDeEvento, "invitadoEmail" | "invitadosEmails">): string[] {
  return d.invitadosEmails ?? (d.invitadoEmail ? [d.invitadoEmail] : []);
}

/** Cuerpo del evento tal como lo pide Google. Puro. */
export function cuerpoDeEvento(d: DatosDeEvento, requestId: string): Record<string, unknown> {
  return {
    summary: d.titulo,
    description: d.descripcion || undefined,
    start: { dateTime: d.inicioIso, timeZone: ZONA_HORARIA },
    end: { dateTime: d.finIso, timeZone: ZONA_HORARIA },
    attendees: invitadosDe(d).length > 0 ? invitadosDe(d).map((email) => ({ email })) : undefined,
    // La marca que permite reconocer, mas adelante, que este evento es del CRM.
    extendedProperties: { private: { crmEventoId: d.crmEventoId } },
    // Alarmas en el calendario de quien programa la cita: 30 y 10 minutos antes.
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }, { method: "popup", minutes: 10 }] },
    conferenceData: d.conMeet
      ? { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } }
      : undefined,
  };
}

export type RangoOcupado = { start: string; end: string };

/** Los rangos ocupados que se cruzan con [inicio, fin). Puro. */
export function choquesCon(ocupados: RangoOcupado[], inicioIso: string, finIso: string): RangoOcupado[] {
  const a = new Date(inicioIso).getTime();
  const b = new Date(finIso).getTime();
  return ocupados.filter((o) => new Date(o.start).getTime() < b && new Date(o.end).getTime() > a);
}

async function llamar<T>(accessToken: string, ruta: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (r.status === 401) throw new ConexionVencidaError();
  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new Error(`Google Calendar respondió ${r.status}: ${detalle.slice(0, 200)}`);
  }
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

/** Cambia el token permanente por uno de acceso (dura una hora). */
export async function accesoDesdeRenovacion(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    // invalid_grant: la persona quito el acceso o el token se revoco.
    if (j.error === "invalid_grant") throw new ConexionVencidaError();
    throw new Error(`No se pudo renovar el acceso con Google (${r.status}).`);
  }
  return ((await r.json()) as { access_token: string }).access_token;
}

export type EventoCreado = { id: string; meetUrl: string | null; enlace: string | null };

type RespuestaEvento = { id: string; hangoutLink?: string; htmlLink?: string; conferenceData?: { createRequest?: { status?: { statusCode?: string } } } };

function aCreado(e: RespuestaEvento): EventoCreado {
  return { id: e.id, meetUrl: e.hangoutLink ?? null, enlace: e.htmlLink ?? null };
}

export async function crearEvento(accessToken: string, datos: DatosDeEvento): Promise<EventoCreado> {
  const requestId = `${datos.crmEventoId}-${Date.now()}`;
  const creado = await llamar<RespuestaEvento>(
    accessToken,
    "/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    { method: "POST", body: JSON.stringify(cuerpoDeEvento(datos, requestId)) }
  );
  // El link de Meet a veces tarda un instante en estar listo.
  if (datos.conMeet && !creado.hangoutLink) {
    await new Promise((r) => setTimeout(r, 1500));
    const otra = await llamar<RespuestaEvento>(accessToken, `/calendars/primary/events/${creado.id}`);
    return aCreado(otra);
  }
  return aCreado(creado);
}

export async function actualizarEvento(
  accessToken: string,
  eventId: string,
  cambios: { titulo?: string; descripcion?: string | null; inicioIso?: string; finIso?: string; invitadoEmail?: string | null; invitadosEmails?: string[] }
): Promise<EventoCreado> {
  const cuerpo: Record<string, unknown> = {};
  if (cambios.titulo !== undefined) cuerpo.summary = cambios.titulo;
  if (cambios.descripcion !== undefined) cuerpo.description = cambios.descripcion ?? "";
  if (cambios.inicioIso) cuerpo.start = { dateTime: cambios.inicioIso, timeZone: ZONA_HORARIA };
  if (cambios.finIso) cuerpo.end = { dateTime: cambios.finIso, timeZone: ZONA_HORARIA };
  if (cambios.invitadosEmails !== undefined) cuerpo.attendees = cambios.invitadosEmails.map((email) => ({ email }));
  else if (cambios.invitadoEmail !== undefined) cuerpo.attendees = cambios.invitadoEmail ? [{ email: cambios.invitadoEmail }] : [];
  const e = await llamar<RespuestaEvento>(accessToken, `/calendars/primary/events/${eventId}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify(cuerpo),
  });
  return aCreado(e);
}

/** Borra el evento. Si ya no existe en Google no es un error. */
export async function borrarEvento(accessToken: string, eventId: string): Promise<void> {
  try {
    await llamar<void>(accessToken, `/calendars/primary/events/${eventId}?sendUpdates=all`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof Error && /respondió (404|410)/.test(err.message)) return;
    throw err;
  }
}

/** Rangos ocupados del calendario principal (solo ocupado/libre, sin titulos). */
export async function rangosOcupados(accessToken: string, desdeIso: string, hastaIso: string): Promise<RangoOcupado[]> {
  const r = await llamar<{ calendars?: { primary?: { busy?: RangoOcupado[] } } }>(accessToken, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: desdeIso, timeMax: hastaIso, timeZone: ZONA_HORARIA, items: [{ id: "primary" }] }),
  });
  return r.calendars?.primary?.busy ?? [];
}

export type EventoDeGoogle = {
  id: string;
  status?: string;
  etag?: string;
  updated?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; self?: boolean; organizer?: boolean }[];
  hangoutLink?: string;
};

export type LecturaDeEvento = { tipo: "sin_cambios" } | { tipo: "borrado" } | { tipo: "evento"; evento: EventoDeGoogle };

/**
 * Lee UN evento por su id (nunca recorre el calendario). Con el etag de la
 * ultima lectura, Google responde 304 si no cambio.
 */
export async function leerEvento(accessToken: string, eventId: string, etag?: string): Promise<LecturaDeEvento> {
  const r = await fetch(`${API}/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...(etag ? { "If-None-Match": etag } : {}) },
  });
  if (r.status === 304) return { tipo: "sin_cambios" };
  if (r.status === 404 || r.status === 410) return { tipo: "borrado" };
  if (r.status === 401) throw new ConexionVencidaError();
  if (!r.ok) throw new Error(`Google Calendar respondió ${r.status}`);
  return { tipo: "evento", evento: (await r.json()) as EventoDeGoogle };
}

/**
 * Abre el canal por el que Google avisa (sin contenido) que algo cambio en el
 * calendario. Exige que el dominio de la direccion este verificado en Google Cloud.
 */
export async function suscribirCanal(
  accessToken: string,
  canal: { id: string; address: string; token: string }
): Promise<{ resourceId: string; expiration: number }> {
  const r = await llamar<{ resourceId: string; expiration: string }>(accessToken, "/calendars/primary/events/watch", {
    method: "POST",
    body: JSON.stringify({ id: canal.id, type: "web_hook", address: canal.address, token: canal.token, params: { ttl: "604800" } }),
  });
  return { resourceId: r.resourceId, expiration: Number(r.expiration) };
}

export async function detenerCanal(accessToken: string, id: string, resourceId: string): Promise<void> {
  await llamar<void>(accessToken, "/channels/stop", { method: "POST", body: JSON.stringify({ id, resourceId }) });
}

export type DatosDeRecordatorio = { crmRecordatorioId: string; texto: string; descripcion: string; inicioIso: string };

/** Cuerpo del evento de un recordatorio: 15 minutos, con alarma al llegar la hora y 10 minutos antes. Puro. */
export function cuerpoDeRecordatorio(d: DatosDeRecordatorio): Record<string, unknown> {
  return {
    summary: `Recordatorio: ${d.texto}`,
    description: d.descripcion,
    start: { dateTime: d.inicioIso, timeZone: ZONA_HORARIA },
    end: { dateTime: new Date(new Date(d.inicioIso).getTime() + 15 * 60_000).toISOString(), timeZone: ZONA_HORARIA },
    // No ocupa el calendario: un recordatorio no debe aparecer como un choque al agendar citas.
    transparency: "transparent",
    extendedProperties: { private: { crmRecordatorioId: d.crmRecordatorioId } },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }, { method: "popup", minutes: 10 }] },
  };
}

export async function crearEventoDeRecordatorio(accessToken: string, d: DatosDeRecordatorio): Promise<string> {
  const e = await llamar<{ id: string }>(accessToken, "/calendars/primary/events", { method: "POST", body: JSON.stringify(cuerpoDeRecordatorio(d)) });
  return e.id;
}

/** Mueve o renombra el evento de un recordatorio. */
export async function actualizarEventoDeRecordatorio(accessToken: string, eventId: string, d: { texto: string; inicioIso: string }): Promise<void> {
  await llamar<void>(accessToken, `/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      summary: `Recordatorio: ${d.texto}`,
      start: { dateTime: d.inicioIso, timeZone: ZONA_HORARIA },
      end: { dateTime: new Date(new Date(d.inicioIso).getTime() + 15 * 60_000).toISOString(), timeZone: ZONA_HORARIA },
    }),
  });
}
