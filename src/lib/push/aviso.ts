/** Lo que lleva cada notificacion de mensaje nuevo. Puro para probarlo. */

export type AvisoDeMensaje = {
  title: string;
  body: string;
  url: string;
  conversationId: string;
  /** Una notificacion por chat: la siguiente del mismo chat la reemplaza (y vuelve a sonar). */
  tag: string;
};

const MAX_VISTA_PREVIA = 120;

/**
 * El titulo lleva el nombre guardado y el numero ("Maria — 573215118640"), para
 * identificar el chat sin abrir la app, igual que la lista de la bandeja.
 */
export function armarAvisoDeMensaje(d: {
  contactName: string | null;
  contactPhone: string;
  messagePreview: string;
  conversationId: string;
}): AvisoDeMensaje {
  const nombre = d.contactName?.trim();
  return {
    title: nombre ? `${nombre} — ${d.contactPhone}` : d.contactPhone,
    body: (d.messagePreview.trim() || "Nuevo mensaje de WhatsApp").slice(0, MAX_VISTA_PREVIA),
    url: `/dashboard/inbox/${d.conversationId}`,
    conversationId: d.conversationId,
    tag: `chat-${d.conversationId}`,
  };
}
