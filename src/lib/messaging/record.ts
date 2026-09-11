import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El unico lugar que escribe en `messages`.
 *
 * Antes habia catorce inserciones repartidas en seis archivos, y cada una
 * tenia que acordarse de dos cosas: poner la fila en `messages` y adelantar
 * `conversations.last_message_at`. Ningun disparador mantiene ese campo -- los
 * dos que existen sobre `messages` (`handle_message_for_followups` y
 * `sync_conversation_for_ai_followups`) mantienen `last_message_direction` y
 * el ancla de seguimientos, no la hora del ultimo mensaje.
 *
 * Acordarse catorce veces es acordarse trece. `lib/ai/agent.ts` era el que se
 * olvidaba: insertaba las respuestas del agente de IA sin tocar la
 * conversacion, asi que la bandeja seguia mostrando la hora del mensaje del
 * cliente y no la de la respuesta. Aqui eso ya no puede pasar, porque las dos
 * escrituras son una sola funcion.
 */

/**
 * Tipos que aparecen hoy en la columna `message_type`.
 *
 * Los cinco primeros son los que la aplicacion envia; el resto solo entran por
 * la ingesta de mensajes del cliente. La lista sale de los valores reales en
 * produccion, no de la documentacion de Meta.
 */
export type OutboundMessageType = "text" | "image" | "audio" | "video" | "document" | "sticker" | "template";

export type OutboundMessage = {
  conversationId: string;
  messageType: OutboundMessageType;
  /** Id que devuelve Meta. Ausente si el envio fallo antes de llegar alla. */
  waMessageId?: string | null;
  body?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  /** Mensaje al que se responde, cuando es una respuesta citada. */
  contextWaMessageId?: string | null;
  /** Botones de la plantilla, para poder pintarlos luego en el chat. */
  buttons?: unknown | null;
  /** Automatizacion que lo origino, cuando no lo mando una persona. */
  viaAutomationId?: string | null;
  /**
   * Marca que hay una persona contestando en vivo. Las campañas saltan a un
   * contacto con un `sent_by_support` reciente para no interrumpir una
   * conversacion que alguien esta atendiendo.
   */
  sentBySupport?: boolean;
  /** Deja el mensaje fuera del conteo que dispara los seguimientos. */
  excludeFromFollowups?: boolean;
  status?: "sent" | "failed";
  /** Motivo del fallo, cuando `status` es "failed". */
  errorDetail?: string | null;
};

/**
 * Persiste un mensaje saliente y adelanta la conversacion.
 *
 * Las dos escrituras son independientes entre si, asi que salen en paralelo:
 * ninguna necesita el resultado de la otra.
 *
 * No es una transaccion. PostgREST no expone una sola, y envolverlas exigiria
 * una funcion en la base. Si la actualizacion fallara, quedaria un mensaje
 * guardado con la conversacion sin adelantar -- el mismo estado en el que
 * dejaba las cosas el codigo anterior, y que se corrige con el siguiente
 * mensaje de esa conversacion.
 */
export async function recordOutboundMessage(
  supabase: SupabaseClient,
  message: OutboundMessage
): Promise<{ error: string | null }> {
  const [insercion, actualizacion] = await Promise.all([
    supabase.from("messages").insert({
      conversation_id: message.conversationId,
      direction: "out",
      message_type: message.messageType,
      body: message.body ?? null,
      media_url: message.mediaUrl ?? null,
      media_mime_type: message.mediaMimeType ?? null,
      wa_message_id: message.waMessageId ?? null,
      context_wa_message_id: message.contextWaMessageId ?? null,
      buttons: message.buttons ?? null,
      via_automation_id: message.viaAutomationId ?? null,
      sent_by_support: message.sentBySupport ?? false,
      exclude_from_followups: message.excludeFromFollowups ?? false,
      status: message.status ?? "sent",
      error_detail: message.errorDetail ?? null,
    }),
    supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", message.conversationId),
  ]);

  return { error: insercion.error?.message ?? actualizacion.error?.message ?? null };
}
