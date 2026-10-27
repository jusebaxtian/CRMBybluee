type MensajeParaReacciones = {
  direction: string;
  message_type: string;
  body: string | null;
  wa_message_id?: string | null;
  context_wa_message_id?: string | null;
};

/**
 * Reacciones vigentes por mensaje, como en WhatsApp: cada lado (el cliente y
 * tu equipo) tiene a lo sumo UNA reaccion por mensaje; la mas reciente
 * reemplaza a la anterior y una reaccion vacia la quita. Devuelve, por el
 * `wa_message_id` del mensaje reaccionado, los emojis a pintar (primero el del
 * cliente, luego el tuyo).
 *
 * `mensajes` debe venir en orden cronologico.
 */
export function reaccionesPorMensaje(mensajes: MensajeParaReacciones[]): Map<string, string[]> {
  const porMensaje = new Map<string, { cliente?: string; equipo?: string }>();
  for (const m of mensajes) {
    if (m.message_type !== "reaction" || !m.context_wa_message_id) continue;
    const lado = m.direction === "in" ? "cliente" : "equipo";
    const actual = porMensaje.get(m.context_wa_message_id) ?? {};
    const emoji = m.body?.trim();
    if (emoji) actual[lado] = emoji;
    else delete actual[lado];
    porMensaje.set(m.context_wa_message_id, actual);
  }

  const resultado = new Map<string, string[]>();
  for (const [id, r] of porMensaje) {
    const emojis = [r.cliente, r.equipo].filter((e): e is string => !!e);
    if (emojis.length) resultado.set(id, emojis);
  }
  return resultado;
}
