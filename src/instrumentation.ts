/**
 * Trabajos de fondo.
 *
 * Hoy corren dentro del proceso web. La Fase 4 los saca a un proceso aparte,
 * y esta variable es la palanca: el proceso web arrancara con
 * RUN_BACKGROUND_JOBS=0 y el trabajador sin ella.
 *
 * El valor por defecto es ENCENDIDO, y a proposito. Si fuera al reves, un
 * despliegue que olvidara poner la variable apagaria en silencio todas las
 * automatizaciones, campañas y seguimientos: ningun error, ningun aviso, solo
 * clientes que dejan de recibir mensajes. Olvidarla en este sentido deja el
 * comportamiento de siempre, que es el fallo barato.
 */
export function trabajosActivos(): boolean {
  const valor = process.env.RUN_BACKGROUND_JOBS?.trim().toLowerCase();
  return valor !== "0" && valor !== "false" && valor !== "off";
}

export async function register() {
  // Only run in the actual Node.js server process, not the edge runtime or
  // during `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!trabajosActivos()) {
    console.log("trabajos de fondo: DESACTIVADOS en este proceso (RUN_BACKGROUND_JOBS)");
    return;
  }

  const { processDueAutomationRuns } = await import("@/lib/automations/scheduler");
  const { expireTrials, expireLapsedActiveSubscriptions, cleanupAbandonedBoldOrders } = await import("@/lib/billing/scheduler");
  const { processAiFollowups } = await import("@/lib/ai/followups");
  const { cleanupOldNotifications } = await import("@/lib/notifications/scheduler");
  const { processDueCampaigns } = await import("@/lib/campaigns/scheduler");
  const { deleteStaleUnactivatedWorkspaces } = await import("@/lib/billing/cleanup");

  const MINUTO = 60_000;

  // Antes eran ocho bloques setInterval identicos salvo el nombre y el
  // periodo. Como tabla se ve de un vistazo que corre y cada cuanto, que es
  // justo lo que hay que saber al repartirlos entre dos procesos.
  const trabajos: { nombre: string; cadaMs: number; correr: () => Promise<unknown> }[] = [
    { nombre: "automatizaciones", cadaMs: 20_000, correr: processDueAutomationRuns },
    { nombre: "campañas", cadaMs: 30_000, correr: processDueCampaigns },
    { nombre: "seguimientos IA", cadaMs: MINUTO, correr: processAiFollowups },
    { nombre: "fin de prueba", cadaMs: 5 * MINUTO, correr: expireTrials },
    { nombre: "suscripciones vencidas", cadaMs: 5 * MINUTO, correr: expireLapsedActiveSubscriptions },
    { nombre: "limpieza de notificaciones", cadaMs: 60 * MINUTO, correr: cleanupOldNotifications },
    { nombre: "espacios sin activar", cadaMs: 60 * MINUTO, correr: deleteStaleUnactivatedWorkspaces },
    { nombre: "ordenes de Bold abandonadas", cadaMs: 60 * MINUTO, correr: cleanupAbandonedBoldOrders },
  ];

  for (const trabajo of trabajos) {
    setInterval(() => {
      trabajo.correr().catch((err) => {
        console.error(`trabajo de fondo "${trabajo.nombre}" fallo:`, err);
      });
    }, trabajo.cadaMs);
  }

  vigilarMemoria();

  console.log(`trabajos de fondo: ${trabajos.length} activos en este proceso`);
}

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
function vigilarMemoria() {
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
