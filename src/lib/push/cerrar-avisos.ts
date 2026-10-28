/**
 * Limpieza de los avisos del celular que ya no corresponden. Corre en el
 * navegador (no en el service worker): se llama al abrir la app, al volver a
 * ella y al entrar a un chat.
 *
 * Los avisos de mensajes llevan el `tag` "chat-<id de la conversacion>". Los
 * demas (prueba, referidos...) no se tocan.
 */

const PREFIJO = "chat-";

async function avisosDeChats(): Promise<Notification[]> {
  try {
    if (!("serviceWorker" in navigator)) return [];
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return [];
    return (await reg.getNotifications()).filter((n) => n.tag.startsWith(PREFIJO));
  } catch {
    return [];
  }
}

/** Cierra el aviso de un chat (por ejemplo, al abrirlo: ya se esta leyendo). */
export async function cerrarAvisoDelChat(conversationId: string): Promise<void> {
  for (const n of await avisosDeChats()) {
    if (n.tag === `${PREFIJO}${conversationId}`) n.close();
  }
}

/**
 * Deja solo los avisos de chats que de verdad siguen sin leer. Con una lista
 * vacia se cierran todos los de chats.
 */
export async function cerrarAvisosObsoletos(idsSinLeer: string[]): Promise<void> {
  const vigentes = new Set(idsSinLeer.map((id) => `${PREFIJO}${id}`));
  for (const n of await avisosDeChats()) {
    if (!vigentes.has(n.tag)) n.close();
  }
}

/** Numero de chats sin leer en el icono de la app, donde el sistema lo permite. */
export async function ponerInsigniaDeLaApp(chatsSinLeer: number): Promise<void> {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  try {
    await (chatsSinLeer > 0 ? nav.setAppBadge(chatsSinLeer) : nav.clearAppBadge());
  } catch {
    // La insignia es un extra.
  }
}
