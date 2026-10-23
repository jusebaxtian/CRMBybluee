/**
 * Horas de la Agenda en hora de Bogota (UTC-5 todo el año, sin horario de
 * verano). El formulario entrega "2026-10-20T15:00" y quiere decir las 3 pm de
 * Bogota, sea cual sea la zona del navegador de quien lo escribe.
 */
const DESFASE_BOGOTA = "-05:00";

export function bogotaAIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00${DESFASE_BOGOTA}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function sumarMinutos(iso: string, minutos: number): string {
  return new Date(new Date(iso).getTime() + minutos * 60_000).toISOString();
}

/** El valor para <input type="datetime-local"> en hora de Bogota. */
export function isoABogotaLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 5 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

export function correoValido(c: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 254;
}

export function textoDeFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}
