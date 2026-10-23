/**
 * Seguimientos del agente de IA: que conversaciones les toca ya, y como se
 * evita que un seguimiento repita lo que ya se dijo.
 *
 * Todo puro (sin base de datos ni red) para poder probarlo. El trabajo que
 * envia esta en `followups.ts`.
 */

export type PasoDeSeguimiento = { delay_minutes: number; focus: string };

export type ConversacionPendiente = {
  id: string;
  contact_id: string;
  whatsapp_account_id: string | null;
  /** Cuantos seguimientos se han enviado ya: es el indice del paso que sigue. */
  ai_followup_count: number;
  /** Desde cuando el cliente no responde. Cada paso se cuenta desde aqui, no desde el paso anterior. */
  ai_followup_started_at: string | null;
};

/** Cuantos seguimientos se envian como maximo en cada vuelta (cada minuto). */
export const LOTE_POR_VUELTA = 25;

/** Cuantas conversaciones se revisan como maximo en una vuelta: las excluidas no cuentan para el lote pero si cuestan consultas. */
export const REVISION_MAXIMA_POR_VUELTA = 80;

const MINUTO_MS = 60_000;

/** Atraso minimo que se tolera, aunque el paso sea de pocos minutos (un reinicio o una cola lenta no debe descartar nada). */
export const TOLERANCIA_MINIMA_MIN = 30;

/** Instante (ms) en que le toca el paso a una conversacion. */
export function momentoDelPaso(inicioIso: string, delayMinutes: number): number {
  return new Date(inicioIso).getTime() + delayMinutes * MINUTO_MS;
}

/**
 * Cuanto atraso admite un paso antes de que enviarlo ya no tenga sentido: el
 * mayor entre media hora y la mitad de su propia espera. Un "recordatorio a
 * los 5 minutos" enviado tres dias despues no es un recordatorio: es ruido, y
 * a la persona le llega sin contexto. Se descarta en vez de mandarlo tarde.
 */
export function toleranciaDeAtrasoMs(delayMinutes: number): number {
  return Math.max(TOLERANCIA_MINIMA_MIN, delayMinutes / 2) * MINUTO_MS;
}

export type Clasificada = {
  conversacion: ConversacionPendiente;
  paso: PasoDeSeguimiento;
  venceEn: number;
  atrasoMs: number;
};

/**
 * Separa las conversaciones en: las que les toca enviar ahora (la mas atrasada
 * primero), las que se pasaron de tiempo, y las que todavia esperan.
 *
 * El orden importa: antes se tomaban 25 conversaciones cualquiera de la base y
 * DESPUES se miraba cuales les tocaba. Con mas de 25 pendientes (Fundetec tenia
 * 147), siempre eran las mismas 25, y a las demas nunca les llegaba su turno:
 * 117 seguimientos con mas de 15 minutos de atraso y el peor con casi 3 dias.
 */
export function clasificarPendientes(
  conversaciones: ConversacionPendiente[],
  pasos: PasoDeSeguimiento[],
  ahoraMs: number
): { tocan: Clasificada[]; vencidas: Clasificada[] } {
  const tocan: Clasificada[] = [];
  const vencidas: Clasificada[] = [];
  for (const conversacion of conversaciones) {
    const paso = pasos[conversacion.ai_followup_count];
    if (!paso || !conversacion.ai_followup_started_at) continue;
    const venceEn = momentoDelPaso(conversacion.ai_followup_started_at, paso.delay_minutes);
    const atrasoMs = ahoraMs - venceEn;
    if (atrasoMs < 0) continue;
    const item = { conversacion, paso, venceEn, atrasoMs };
    (atrasoMs > toleranciaDeAtrasoMs(paso.delay_minutes) ? vencidas : tocan).push(item);
  }
  tocan.sort((a, b) => a.venceEn - b.venceEn);
  return { tocan, vencidas };
}

// ---------------------------------------------------------------------------
// Que no diga lo mismo
// ---------------------------------------------------------------------------

const PALABRAS_VACIAS = new Set([
  "para", "pero", "como", "esto", "esta", "este", "esos", "esas", "estos", "estas", "solo", "sino", "mas",
  "muy", "con", "sin", "por", "que", "los", "las", "una", "uno", "unos", "unas", "del", "al", "tus", "tu",
  "mis", "mi", "hay", "ser", "has", "han", "fue", "son", "sus", "su", "aqui", "alli", "hoy", "ahi",
]);

function palabrasDe(texto: string): Set<string> {
  return new Set(
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length >= 3 && !PALABRAS_VACIAS.has(p))
  );
}

/** Parecido entre dos textos, de 0 (nada en comun) a 1 (las mismas palabras). */
export function parecidoDeTextos(a: string, b: string): number {
  const pa = palabrasDe(a);
  const pb = palabrasDe(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes++;
  return comunes / (pa.size + pb.size - comunes);
}

/** A partir de este parecido, un mensaje nuevo cuenta como repeticion de uno anterior. */
export const UMBRAL_DE_REPETICION = 0.55;

/** El mas parecido de los mensajes anteriores, o null si ninguno pasa el umbral. */
export function mensajeQueRepite(nuevo: string, anteriores: string[]): string | null {
  let mejor: { texto: string; parecido: number } | null = null;
  for (const previo of anteriores) {
    const parecido = parecidoDeTextos(nuevo, previo);
    if (parecido >= UMBRAL_DE_REPETICION && (!mejor || parecido > mejor.parecido)) mejor = { texto: previo, parecido };
  }
  return mejor?.texto ?? null;
}

/** "hace 3 horas" para decirselo al modelo; no necesita ser exacto. */
export function tiempoLegible(minutos: number): string {
  if (minutos < 60) return `${Math.max(1, Math.round(minutos))} minuto${Math.round(minutos) === 1 ? "" : "s"}`;
  if (minutos < 60 * 24) {
    const h = Math.round(minutos / 60);
    return `${h} hora${h === 1 ? "" : "s"}`;
  }
  const d = Math.round(minutos / (60 * 24));
  return `${d} día${d === 1 ? "" : "s"}`;
}

/**
 * El texto de una plantilla con sus variables ya puestas, tal como lo recibe el
 * cliente. El chat guardaba el cuerpo SIN rellenar ("Hola {{1}}, ...") y el
 * equipo veia las llaves en vez del nombre.
 */
export function rellenarPlantilla(cuerpo: string | null, parametros: (string | null | undefined)[] | undefined): string | null {
  if (cuerpo === null) return null;
  return cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => parametros?.[Number(n) - 1] ?? "");
}
