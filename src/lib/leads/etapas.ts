/**
 * Etapas de un lead (migracion 0168). Las clases van completas para que Tailwind
 * las vea.
 */
export const ETAPAS = ["frio", "tibio", "caliente", "pago"] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ESTILO_ETAPA: Record<Etapa, { texto: string; clase: string }> = {
  frio: { texto: "Frío", clase: "bg-info/15 text-info" },
  tibio: { texto: "Tibio", clase: "bg-warning/15 text-warning" },
  caliente: { texto: "Caliente", clase: "bg-red-500/15 text-red-400" },
  pago: { texto: "Pagó", clase: "bg-success/15 text-success" },
};

export function esEtapa(valor: unknown): valor is Etapa {
  return typeof valor === "string" && (ETAPAS as readonly string[]).includes(valor);
}

/**
 * Que mostrar en la columna de una etapa. Sin fecha hay dos casos: la etapa actual
 * del contacto se sabe por su etiqueta vieja pero no cuando llego ("Sin fecha"), y
 * cualquier otra aun no ocurrio o se salto ("Sin llegar").
 */
export function fechaDeEtapa(
  columna: Etapa,
  etapaActual: Etapa,
  fecha: string | null
): { tipo: "fecha"; fecha: string } | { tipo: "sin-fecha" } | { tipo: "sin-llegar" } {
  if (fecha) return { tipo: "fecha", fecha };
  return columna === etapaActual ? { tipo: "sin-fecha" } : { tipo: "sin-llegar" };
}
