/**
 * Quien envio un mensaje saliente, para el nombre arriba de la burbuja
 * (decision del 3 nov 2026, migracion 0165). Solo lo ve el equipo en el CRM.
 */
export type Remitente = { clave: string; texto: string; tono: string };

type MensajeConOrigen = {
  direction: string;
  sent_from_app?: boolean | null;
  origen?: string | null;
  via_automation_id?: string | null;
  sent_by_user_id?: string | null;
};

const FIJOS: Record<string, { texto: string; tono: string }> = {
  ia: { texto: "🤖 Agente IA", tono: "text-sky-200" },
  campana: { texto: "📣 Campaña", tono: "text-orange-200" },
  flujo: { texto: "🔀 Flujo", tono: "text-teal-200" },
  api: { texto: "🔌 API", tono: "text-slate-200" },
  sistema: { texto: "🔔 Aviso del sistema", tono: "text-slate-200" },
  automatizacion: { texto: "⚡ Automatización", tono: "text-violet-200" },
  app: { texto: "📱 Desde la app", tono: "text-rose-200" },
  // El administrador de la plataforma, en su espacio o en modo soporte (decision del 3 nov 2026).
  soporte: { texto: "💎 Team Bybluee", tono: "text-cyan-200" },
};

/** Colores para las personas del equipo: cada una conserva el suyo (sale de su id). */
const TONOS_PERSONA = ["text-lime-200", "text-amber-200", "text-pink-200", "text-emerald-100", "text-yellow-100", "text-fuchsia-200"];

function tonoDe(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS_PERSONA[h % TONOS_PERSONA.length];
}

/**
 * Prioridad: lo escrito desde la app del celular, lo que no es una persona (IA,
 * campaña…), una automatizacion y por ultimo la persona. El administrador de la
 * plataforma (en su espacio o en modo soporte) sale siempre como "💎 Team Bybluee".
 * Sin ningun dato (mensajes de antes de la 0165) no se muestra nada.
 *
 * Ojo: messages.sent_by_support NO sirve para esto: se marca en todo mensaje
 * escrito por una persona (lo usan las campañas para no interrumpir un chat vivo).
 */
export function remitenteDe(
  m: MensajeConOrigen,
  nombres: Map<string, string>,
  yo: string | null,
  deSoporte: Set<string> = new Set()
): Remitente | null {
  if (m.direction !== "out") return null;
  const fijo = (clave: string): Remitente => ({ clave, ...FIJOS[clave] });
  if (m.sent_from_app) return fijo("app");
  if (m.origen && FIJOS[m.origen]) return fijo(m.origen);
  if (m.via_automation_id) return fijo("automatizacion");
  if (m.sent_by_user_id && deSoporte.has(m.sent_by_user_id)) return fijo("soporte");
  if (m.sent_by_user_id) {
    const nombre = nombres.get(m.sent_by_user_id) ?? "Equipo";
    return {
      clave: `u:${m.sent_by_user_id}`,
      texto: m.sent_by_user_id === yo ? `${nombre} (tú)` : nombre,
      tono: tonoDe(m.sent_by_user_id),
    };
  }
  return null;
}
