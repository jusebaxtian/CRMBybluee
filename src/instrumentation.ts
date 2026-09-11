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

  // Se importa aqui y no arriba: process.memoryUsage() y process.uptime() no
  // existen en el Edge Runtime, y Next analiza este fichero para los dos
  // entornos. La guarda de NEXT_RUNTIME evita que se ejecute alli, pero no
  // que el analisis lo mire; con import() dinamico deja de verlo.
  const { vigilarMemoria } = await import("@/lib/observabilidad/memoria");
  vigilarMemoria();

  console.log(`trabajos de fondo: ${trabajos.length} activos en este proceso`);
}
