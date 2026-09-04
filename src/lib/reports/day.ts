// "Hoy" para los reportes se calcula en horario de Colombia (America/Bogota,
// siempre UTC-5), no en la zona del servidor — así el corte del día coincide
// con lo que ve el usuario, sin importar dónde corra el proceso.
export function bogotaDayRange(now: Date = new Date()): {
  ymd: string;
  startIso: string;
  endIso: string;
} {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return {
    ymd,
    startIso: new Date(`${ymd}T00:00:00-05:00`).toISOString(),
    endIso: new Date(`${ymd}T23:59:59.999-05:00`).toISOString(),
  };
}
