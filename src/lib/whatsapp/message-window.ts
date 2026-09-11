/**
 * La ventana de 24 horas de WhatsApp.
 *
 * Meta solo permite mensajes de texto libre dentro de las 24 horas siguientes
 * al ultimo mensaje entrante del contacto. Fuera de esa ventana unicamente
 * salen plantillas aprobadas; intentar texto libre devuelve el error 131047.
 *
 * Esta es la unica definicion de la regla en el codigo. Antes estaba escrita
 * dos veces (el hook y el panel de la bandeja, cada uno con su constante), y
 * dos copias de una regla ajena son dos formas de equivocarse.
 *
 * OJO: existe una tercera definicion fuera de TypeScript. La funcion SQL
 * `resolve_campaign_recipients` decide con `interval '24 hours'` que contactos
 * tienen la ventana abierta al armar la audiencia de una campaña. Si algun dia
 * Meta cambia el plazo, hay que tocar los dos lados: este archivo y esa
 * funcion, via migracion.
 */
export const MESSAGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Desde cuanto antes de expirar se avisa que la ventana esta por vencerse.
 * Dos horas es el margen con el que un agente todavia alcanza a responder.
 */
export const EXPIRING_SOON_MAX_MS = 2 * 60 * 60 * 1000;

/**
 * Por debajo de esto ya no se muestra la advertencia: faltan segundos y el
 * aviso solo alcanzaria a parpadear antes de que la ventana cierre.
 */
export const EXPIRING_SOON_MIN_MS = 10 * 1000;

/** Cuando cierra la ventana, o null si el contacto nunca ha escrito. */
export function windowExpiresAt(lastInboundAt: string | null): Date | null {
  if (!lastInboundAt) return null;
  return new Date(new Date(lastInboundAt).getTime() + MESSAGE_WINDOW_MS);
}

/**
 * Milisegundos que faltan para que cierre. Negativo si ya cerro, y 0 cuando el
 * contacto nunca escribio (no hay ventana que contar).
 */
export function msRemainingInWindow(lastInboundAt: string | null, now: number): number {
  const expiresAt = windowExpiresAt(lastInboundAt);
  if (!expiresAt) return 0;
  return expiresAt.getTime() - now;
}

/** Si en este instante se puede enviar texto libre. */
export function isWindowOpen(lastInboundAt: string | null, now: number): boolean {
  if (!lastInboundAt) return false;
  return msRemainingInWindow(lastInboundAt, now) > 0;
}

/** Si toca avisar que la ventana esta a punto de cerrarse. */
export function isWindowExpiringSoon(lastInboundAt: string | null, now: number): boolean {
  if (!lastInboundAt) return false;
  const restante = msRemainingInWindow(lastInboundAt, now);
  return restante >= EXPIRING_SOON_MIN_MS && restante <= EXPIRING_SOON_MAX_MS;
}
