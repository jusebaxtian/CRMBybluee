/**
 * Deja una linea de memoria cada cinco minutos.
 *
 * La Fase 2 pedia un diagnostico escrito de la fuga y lo que hay es una
 * correlacion: el proceso se mantiene plano durante dias (75 MB a las 7 h,
 * 78 MB a las 46 h) y el unico volcado por falta de memoria que existe en los
 * registros ocurrio a las 54 h con el heap en 2007 MB, justo detras de una
 * rafaga de fallos de entrega de una campaña.
 *
 * Con una sola medicion al final no se puede distinguir "crece poco a poco"
 * de "se dispara durante el envio". Esta traza da la curva, que es lo que
 * falta para convertir la correlacion en causa.
 *
 * Solo se registra en el proceso que corre los trabajos: es el que envia y el
 * que sospechamos.
 */
export function vigilarMemoria() {
  const CADA_MS = 5 * 60_000;
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

  let picoRss = 0;

  setInterval(() => {
    const uso = process.memoryUsage();
    const rss = mb(uso.rss);
    if (rss > picoRss) picoRss = rss;

    console.log(
      `memoria: rss=${rss}MB heap=${mb(uso.heapUsed)}/${mb(uso.heapTotal)}MB ` +
        `externa=${mb(uso.external)}MB pico=${picoRss}MB ` +
        `arriba=${Math.round(process.uptime() / 60)}min`
    );
  }, CADA_MS).unref();
}
