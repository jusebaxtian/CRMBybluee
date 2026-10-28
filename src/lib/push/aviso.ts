/** Lo que lleva cada notificacion de mensaje nuevo. Puro para probarlo. */

export type AvisoDeMensaje = {
  title: string;
  body: string;
  url: string;
  conversationId: string;
  /** Una notificacion por chat: la siguiente del mismo chat la reemplaza (y vuelve a sonar). */
  tag: string;
  /** Chats realmente sin leer de quien recibe el aviso: es el numero del icono de la app. */
  unreadTotal?: number;
  /** Mensajes sin leer de ESTE chat: es el "(N)" del titulo. */
  unreadChat?: number;
};

/**
 * Lo que dice el aviso cuando el mensaje no trae texto. Antes todo lo que no
 * era texto (fotos, notas de voz, stickers: la mitad de lo que llega) salia
 * como "Nuevo mensaje de WhatsApp" y no habia forma de saber que era.
 */
export function vistaPreviaDeMensaje(tipo: string, texto: string | null | undefined): string {
  const t = texto?.trim();
  if (t) return t;
  switch (tipo) {
    case "image":
      return "📷 Foto";
    case "video":
      return "🎥 Video";
    case "audio":
      return "🎤 Nota de voz";
    case "document":
      return "📄 Documento";
    case "sticker":
      return "🩹 Sticker";
    case "location":
      return "📍 Ubicación";
    case "contacts":
      return "👤 Contacto";
    case "unsupported":
      return "⚠️ Mensaje que WhatsApp no deja ver por la API";
    default:
      return "Nuevo mensaje de WhatsApp";
  }
}

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
  unreadTotal?: number;
  unreadChat?: number;
}): AvisoDeMensaje {
  const nombre = d.contactName?.trim();
  return {
    title: nombre ? `${nombre} — ${d.contactPhone}` : d.contactPhone,
    body: (d.messagePreview.trim() || "Nuevo mensaje de WhatsApp").slice(0, MAX_VISTA_PREVIA),
    url: `/dashboard/inbox/${d.conversationId}`,
    conversationId: d.conversationId,
    tag: `chat-${d.conversationId}`,
    ...(d.unreadTotal !== undefined ? { unreadTotal: d.unreadTotal } : {}),
    ...(d.unreadChat !== undefined ? { unreadChat: d.unreadChat } : {}),
  };
}
