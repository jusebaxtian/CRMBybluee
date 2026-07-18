import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-types";
import { runKeywordAutomations } from "@/lib/automations/engine";
import { getMediaUrl, downloadMedia } from "@/lib/whatsapp/graph";

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
        const profileName = value.contacts?.find((c) => c.wa_id === message.from)
          ?.profile?.name;

        const { data: contact } = await supabase
          .from("contacts")
          .upsert(
            { workspace_id: workspaceId, wa_id: message.from, name: profileName },
            { onConflict: "workspace_id,wa_id", ignoreDuplicates: false }
          )
          .select("id")
          .single();

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
          .select("id")
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

        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          direction: "in",
          message_type: message.type,
          body:
            message.text?.body ??
            (message.image?.caption || message.video?.caption || message.document?.caption) ??
            (message.document?.filename ?? null),
          media_url: mediaUrl,
          media_mime_type: mediaMimeType,
          wa_message_id: message.id,
          status: "delivered",
          created_at: new Date(Number(message.timestamp) * 1000).toISOString(),
        });

        if (message.text?.body) {
          await runKeywordAutomations(supabase, workspaceId, contact.id, message.text.body);
        }
      }

      for (const status of value.statuses ?? []) {
        await supabase
          .from("messages")
          .update({ status: status.status })
          .eq("wa_message_id", status.id);
      }
    }
  }
}
