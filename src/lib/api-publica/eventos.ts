/** Eventos que puede avisar un webhook. Archivo aparte (sin servidor) para poder usarlo tambien en pantalla. */

export const EVENTOS = [
  { clave: "mensaje.recibido", titulo: "Mensaje recibido", detalle: "Un cliente escribió" },
  { clave: "mensaje.enviado", titulo: "Mensaje enviado", detalle: "Se envió un mensaje (desde el CRM, una automatización o la API)" },
  { clave: "mensaje.entregado", titulo: "Mensaje entregado", detalle: "WhatsApp confirmó la entrega" },
  { clave: "mensaje.leido", titulo: "Mensaje leído", detalle: "El cliente leyó el mensaje" },
  { clave: "mensaje.fallido", titulo: "Mensaje fallido", detalle: "WhatsApp no pudo entregarlo" },
  { clave: "contacto.creado", titulo: "Contacto creado", detalle: "Entró un contacto nuevo" },
  { clave: "contacto.actualizado", titulo: "Contacto actualizado", detalle: "Cambió su nombre, notas, teléfono o variables" },
  { clave: "etiqueta.asignada", titulo: "Etiqueta asignada", detalle: "Se le puso una etiqueta a un contacto" },
  { clave: "conversacion.asignada", titulo: "Conversación asignada", detalle: "Se asignó (o se quitó) a un agente" },
] as const;

export type EventoWebhook = (typeof EVENTOS)[number]["clave"];

const CLAVES = new Set<string>(EVENTOS.map((e) => e.clave));

export function eventosValidos(entrada: unknown): EventoWebhook[] {
  if (!Array.isArray(entrada)) return [];
  return [...new Set(entrada.filter((e): e is EventoWebhook => typeof e === "string" && CLAVES.has(e)))];
}
