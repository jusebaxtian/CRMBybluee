/**
 * Etiquetas de temporada junto al nombre en el menu. Cada una aparece sola en su
 * rango de fechas (hora de Bogota) y se quita sola al terminar. Para otro año o
 * rango basta con cambiar esta lista.
 */
export type IdTemporada = "halloween" | "navidad" | "ofertas";

type Rango = { id: IdTemporada; anio: number; mes: number; desdeDia: number; hastaDia: number };

export const TEMPORADAS: Rango[] = [
  { id: "ofertas", anio: 2026, mes: 10, desdeDia: 15, hastaDia: 17 },
  { id: "halloween", anio: 2026, mes: 10, desdeDia: 28, hastaDia: 31 },
  { id: "navidad", anio: 2026, mes: 12, desdeDia: 7, hastaDia: 25 },
];

/** Bogota es UTC-5 todo el año: la fecha "de pared" se saca restando 5 horas. */
function fechaEnBogota(ahoraMs: number): { anio: number; mes: number; dia: number } {
  const d = new Date(ahoraMs - 5 * 3_600_000);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

/** La temporada que toca hoy, o null. */
export function temporadaActiva(ahoraMs: number = Date.now()): IdTemporada | null {
  const f = fechaEnBogota(ahoraMs);
  const t = TEMPORADAS.find((r) => r.anio === f.anio && r.mes === f.mes && f.dia >= r.desdeDia && f.dia <= r.hastaDia);
  return t?.id ?? null;
}

export function esTemporada(valor: string | null): valor is IdTemporada {
  return valor === "halloween" || valor === "navidad" || valor === "ofertas";
}
