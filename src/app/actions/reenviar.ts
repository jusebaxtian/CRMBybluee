"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { abrirConversacion } from "@/lib/whatsapp/conversacion";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp/graph";
import { recordOutboundMessage } from "@/lib/messaging/record";
import { msRemainingInWindow } from "@/lib/whatsapp/message-window";

/**
 * Reenviar un mensaje de un chat a otros chats del mismo espacio.
 *
 * Texto y adjuntos (foto, video, audio, documento): el adjunto se reenvia
 * por su URL publica de storage, igual que hacen las automatizaciones. Cada
 * destino se envia por separado y se informa el resultado uno a uno; un
 * contacto fuera de la ventana de 24 h no bloquea a los demas.
 */

const MAX_DESTINOS = 20;
const REENVIABLES = new Set(["text", "image", "video", "audio", "document"]);

export type ResultadoReenvio = { contactId: string; nombre: string; ok: boolean; error?: string };

export async function buscarContactosParaReenviar(termino: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error, contactos: [] as { id: string; name: string | null; wa_id: string }[] };
  const q = termino.trim();
  let query = ctx.supabase
    .from("contacts")
    .select("id, name, wa_id")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (q) {
    const digitos = q.replace(/\D/g, "");
    const filtros = [`name.ilike.%${q.replace(/[%,]/g, "")}%`];
    if (digitos.length >= 3) filtros.push(`wa_id.ilike.%${digitos}%`);
    query = query.or(filtros.join(","));
  }
  const { data } = await query;
  return { contactos: (data ?? []) as { id: string; name: string | null; wa_id: string }[] };
}

export async function reenviarMensaje(input: { messageId: string; contactIds: string[] }) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const destinos = [...new Set(input.contactIds)].slice(0, MAX_DESTINOS);
  if (destinos.length === 0) return { error: "Elige al menos un chat." };

  // El mensaje debe ser del espacio activo (RLS ya lo garantiza; se comprueba igual).
  const { data: mensaje } = await supabase
    .from("messages")
    .select("id, message_type, body, media_url, media_mime_type, conversations!inner(workspace_id)")
    .eq("id", input.messageId)
    .maybeSingle();
  const propietario = (mensaje?.conversations as unknown as { workspace_id: string } | null)?.workspace_id;
  if (!mensaje || propietario !== workspaceId) return { error: "Mensaje no encontrado." };
  if (!REENVIABLES.has(mensaje.message_type)) return { error: "Este tipo de mensaje no se puede reenviar." };
  if (mensaje.message_type !== "text" && !mensaje.media_url) return { error: "El adjunto ya no está disponible." };

  const { data: contactos } = await supabase
    .from("contacts")
    .select("id, name, wa_id")
    .eq("workspace_id", workspaceId)
    .in("id", destinos);

  const resultados: ResultadoReenvio[] = [];
  let algunaConversacion: string | null = null;

  for (const contacto of contactos ?? []) {
    const nombre = contacto.name?.trim() || contacto.wa_id;
    try {
      // Misma logica que "nuevo mensaje": reutiliza el hilo mas reciente del
      // contacto (o lo abre con la linea por defecto).
      const conversacion = await abrirConversacion(supabase, workspaceId, contacto.id);
      if (!conversacion) throw new Error("No se pudo abrir el chat.");

      // Fuera de las 24 h Meta rechaza texto libre y adjuntos: se avisa antes
      // de intentar, con el mismo criterio que usa el compositor.
      const { data: ultimoEntrante } = await supabase
        .from("messages")
        .select("created_at")
        .eq("conversation_id", conversacion.id)
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ultimoEntrante || msRemainingInWindow(ultimoEntrante.created_at, Date.now()) <= 0) {
        throw new Error("Fuera de la ventana de 24 h: solo se le puede escribir con una plantilla.");
      }

      const cuenta = await resolveSendAccount(supabase, workspaceId, conversacion.whatsapp_account_id);
      if (!cuenta) throw new Error("No hay un número de WhatsApp conectado.");

      let waMessageId: string | undefined;
      if (mensaje.message_type === "text") {
        const r = await sendTextMessage(cuenta.phone_number_id, cuenta.access_token, contacto.wa_id, mensaje.body ?? "");
        waMessageId = r.messages[0]?.id;
      } else {
        const tipo = mensaje.message_type as "image" | "video" | "audio" | "document";
        const nombreArchivo = tipo === "document" ? mensaje.body ?? undefined : undefined;
        const pie = tipo === "image" || tipo === "video" ? mensaje.body ?? undefined : undefined;
        const r = await sendMediaMessage(
          cuenta.phone_number_id,
          cuenta.access_token,
          contacto.wa_id,
          tipo,
          { link: mensaje.media_url! },
          nombreArchivo,
          pie
        );
        waMessageId = r.messages[0]?.id;
      }

      await recordOutboundMessage(supabase, {
        conversationId: conversacion.id,
        messageType: mensaje.message_type,
        body: mensaje.body,
        mediaUrl: mensaje.media_url,
        mediaMimeType: mensaje.media_mime_type,
        waMessageId,
        sentBySupport: true,
      });
      algunaConversacion = conversacion.id;
      revalidatePath(`/dashboard/inbox/${conversacion.id}`);
      resultados.push({ contactId: contacto.id, nombre, ok: true });
    } catch (err) {
      resultados.push({ contactId: contacto.id, nombre, ok: false, error: err instanceof Error ? err.message : "Error desconocido." });
    }
  }

  if (algunaConversacion) revalidatePath("/dashboard/inbox");
  return { resultados };
}
