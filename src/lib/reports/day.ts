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

// "Ayer" en horario de Colombia: el dM-CM--a calendario anterior al de `now`,
// tambiM-CM-)n anclado a UTC-5 para que el corte coincida con lo que ve el usuario.
export function bogotaYesterdayRange(now: Date = new Date()): {
  ymd: string;
  startIso: string;
  endIso: string;
} {
  const todayYmd = bogotaDayRange(now).ymd;
  // Tomamos el mediodia de hoy (UTC-5) y restamos un dia para caer con
  // seguridad dentro de ayer; Colombia no usa horario de verano.
  const yesterday = new Date(`${todayYmd}T12:00:00-05:00`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return bogotaDayRange(yesterday);
}
