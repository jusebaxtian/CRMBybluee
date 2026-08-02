import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-types";
import { runKeywordAutomations } from "@/lib/automations/engine";
import { getMediaUrl, downloadMedia } from "@/lib/whatsapp/graph";
import { notifyNewMessage } from "@/lib/push/send";

// Translates the most common Cloud API delivery-failure codes into a short,
// actionable message an agent can actually understand — the raw error is
// still logged in full via console.error for debugging.
function friendlyWhatsAppError(error: {
  code: number;
  title: string;
  message?: string;
  error_data?: { details?: string };
}): string {
  switch (error.code) {
    case 131047:
      return "No se pudo enviar: han pasado más de 24 horas desde el último mensaje del cliente. Solo se puede reabrir la conversación con una plantilla aprobada.";
    case 131053:
      return `No se pudo enviar: formato de archivo no compatible. ${error.error_data?.details ?? ""}`.trim();
    case 131026:
      return "No se pudo enviar: el número no tiene WhatsApp o no puede recibir mensajes.";
    case 131031:
      return "No se pudo enviar: tu cuenta de WhatsApp Business fue restringida por Meta.";
    default:
      return error.error_data?.details || error.message || error.title || "No se pudo enviar el mensaje.";
  }
}

const extensionFromMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

// Finds or creates the contact for an inbound message. Prefers matching by
// bsuid (Meta's Business-Scoped User ID) when we have one on file — it's
// stable per user+business even if "wa_id" itself changes representation
// between messages (e.g. a username-only contact vs. a phone number once
// Contact Book links them). Falls back to the existing wa_id-based upsert,
// which is still how virtually every contact resolves today.
async function resolveContact(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  waId: string,
  bsuid: string | null,
  profileName: string | undefined
): Promise<{ id: string } | null> {
  if (bsuid) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("bsuid", bsuid)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("contacts")
        .update({ wa_id: waId, ...(profileName ? { name: profileName } : {}) })
        .eq("id", existing.id);
      return existing;
    }
  }

  // Only include bsuid in the payload when we actually have one — on
  // conflict, Supabase's upsert sets every column present in the object, so
  // passing bsuid: null here would wipe out a bsuid learned from an earlier
  // message where it happened to be present.
  const { data: contact } = await supabase
    .from("contacts")
    .upsert(
      {
        workspace_id: workspaceId,
        wa_id: waId,
        name: profileName,
        ...(bsuid ? { bsuid } : {}),
      },
      { onConflict: "workspace_id,wa_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  return contact;
}

async function persistIncomingMedia(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  accessToken: string,
  mediaId: string
): Promise<{ url: string; mimeType: string } | null> {
  try {
    const { url, mime_type } = await getMediaUrl(mediaId, accessToken);
    const blob = await downloadMedia(url, accessToken);
    const ext = extensionFromMime[mime_type] ?? "bin";
    const path = `${workspaceId}/in/${mediaId}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-media")
      .upload(path, blob, { contentType: mime_type, upsert: true });
    if (error) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from("chat-media").getPublicUrl(path);

    return { url: publicUrl, mimeType: mime_type };
  } catch {
    return null;
  }
}

export async function ingestWhatsAppWebhook(payload: WhatsAppWebhookPayload) {
  const supabase = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const { value } = change;
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: account } = await supabase
        .from("whatsapp_accounts")
        .select("workspace_id, access_token")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

      if (!account) continue;
      const workspaceId = account.workspace_id as string;

      for (const message of value.messages ?? []) {
        const contactEntry = value.contacts?.find((c) => c.wa_id === message.from);
        const profileName = contactEntry?.profile?.name;
        const bsuid = message.user_id ?? contactEntry?.user_id ?? null;

        const contact = await resolveContact(supabase, workspaceId, message.from, bsuid, profileName);

        if (!contact) continue;

        const { data: conversation } = await supabase
          .from("conversations")
          .upsert(
            {
              workspace_id: workspaceId,
              contact_id: contact.id,
              last_message_at: new Date(Number(message.timestamp) * 1000).toISOString(),
              status: "open",
            },
            { onConflict: "workspace_id,contact_id" }
          )
          .select("id, assigned_agent_id")
          .single();

        if (!conversation) continue;

        const mediaPayload =
          message.image ?? message.audio ?? message.video ?? message.document ?? null;

        let mediaUrl: string | null = null;
        let mediaMimeType: string | null = null;
        if (mediaPayload) {
          const persisted = await persistIncomingMedia(
            supabase,
            workspaceId,
            account.access_token,
            mediaPayload.id
          );
          mediaUrl = persisted?.url ?? null;
          mediaMimeType = persisted?.mimeType ?? mediaPayload.mime_type;
        }

        const messageBody =
          message.text?.body ??
          (message.image?.caption || message.video?.caption || message.document?.caption) ??
          (message.document?.filename ?? null);

        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          direction: "in",
          message_type: message.type,
          body: messageBody,
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
          wa_message_id: message.id,
          status: "delivered",
          created_at: new Date(Number(message.timestamp) * 1000).toISOString(),
        });

        await notifyNewMessage(
          supabase,
          workspaceId,
          conversation.id,
          conversation.assigned_agent_id,
          profileName ?? null,
          messageBody || "Nuevo mensaje de WhatsApp"
        );

        if (message.text?.body) {
          await runKeywordAutomations(supabase, workspaceId, contact.id, message.text.body);
        }
      }

      for (const status of value.statuses ?? []) {
        let errorDetail: string | null = null;
        if (status.status === "failed" && status.errors?.length) {
          console.error(
            `whatsapp delivery failed for wa_message_id=${status.id}:`,
            JSON.stringify(status.errors)
          );
          errorDetail = friendlyWhatsAppError(status.errors[0]);
        }
        await supabase
          .from("messages")
          .update({ status: status.status, error_detail: errorDetail })
          .eq("wa_message_id", status.id);
      }
    }
  }
}
