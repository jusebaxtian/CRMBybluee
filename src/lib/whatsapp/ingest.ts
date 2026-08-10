import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-types";
import { runKeywordAutomations } from "@/lib/automations/engine";
import { getMediaUrl, downloadMedia } from "@/lib/whatsapp/graph";
import { notifyNewMessage } from "@/lib/push/send";
import { maybeRespondWithAiAgent } from "@/lib/ai/agent";
import { transcribeAudio } from "@/lib/ai/providers";

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

// WhatsApp never tells a business when a customer has blocked them (privacy
// by design) — the closest signal available is this error code, meaning
// "recipient's number is not on WhatsApp or is otherwise unreachable".
// Several of these in a row is the practical proxy for "likely blocked".
const UNREACHABLE_ERROR_CODES = new Set([131026]);
const LIKELY_BLOCKED_THRESHOLD = 3;

async function recordUnreachableFailure(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string
) {
  const { data: contact } = await supabase
    .from("contacts")
    .select("consecutive_failures")
    .eq("id", contactId)
    .maybeSingle();
  const next = (contact?.consecutive_failures ?? 0) + 1;
  await supabase
    .from("contacts")
    .update({ consecutive_failures: next, likely_blocked: next >= LIKELY_BLOCKED_THRESHOLD })
    .eq("id", contactId);
}

async function resetContactReachability(
  supabase: ReturnType<typeof createAdminClient>,
  contactId: string
) {
  await supabase
    .from("contacts")
    .update({ consecutive_failures: 0, likely_blocked: false })
    .eq("id", contactId);
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

// Whisper (transcription) only exists on OpenAI — reuses the workspace's own
// AI agent key if they connected OpenAI. No Anthropic-only equivalent today,
// so voice notes for those workspaces are still saved but not transcribed.
async function transcribeIncomingAudio(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  mediaUrl: string
): Promise<string | null> {
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("provider, api_key, is_active")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!agent || !agent.is_active || agent.provider !== "openai") return null;

  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const text = await transcribeAudio(agent.api_key, blob, "audio.ogg");
    return text || null;
  } catch (err) {
    console.error(`Audio transcription failed for workspace=${workspaceId}:`, err);
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

        // Any inbound message proves the number is reachable — clear
        // whatever failure streak/likely_blocked flag it had.
        await resetContactReachability(supabase, contact.id);

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
          .select("id, assigned_agent_id, ad_source_id")
          .single();

        if (!conversation) continue;

        // Only Meta ("ad") referrals identify a paid campaign — organic
        // "post" shares also set referral but aren't Meta Ads. Written once:
        // a conversation's ad attribution is whichever ad started it, so a
        // later message (which won't carry referral again) must not clear it.
        if (
          message.referral?.source_type === "ad" &&
          message.referral.source_id &&
          !conversation.ad_source_id
        ) {
          await supabase
            .from("conversations")
            .update({
              ad_source_id: message.referral.source_id,
              ad_headline: message.referral.headline ?? null,
              ad_body: message.referral.body ?? null,
              ctwa_clid: message.referral.ctwa_clid ?? null,
            })
            .eq("id", conversation.id);
        }

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

        let audioTranscript: string | null = null;
        if (message.type === "audio" && mediaUrl) {
          audioTranscript = await transcribeIncomingAudio(supabase, workspaceId, mediaUrl);
        }

        const messageBody =
          message.text?.body ??
          (message.image?.caption || message.video?.caption || message.document?.caption) ??
          (message.document?.filename ?? null) ??
          (audioTranscript ? `🎙️ ${audioTranscript}` : null);

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

        const textForAutomations = message.text?.body ?? audioTranscript;
        if (textForAutomations) {
          const matchedKeyword = await runKeywordAutomations(
            supabase,
            workspaceId,
            contact.id,
            textForAutomations
          );
          if (!matchedKeyword) {
            await maybeRespondWithAiAgent(supabase, workspaceId, conversation.id, contact.id);
          }
        }
      }

      for (const status of value.statuses ?? []) {
        let errorDetail: string | null = null;
        let errorCode: number | null = null;
        if (status.status === "failed" && status.errors?.length) {
          console.error(
            `whatsapp delivery failed for wa_message_id=${status.id}:`,
            JSON.stringify(status.errors)
          );
          errorDetail = friendlyWhatsAppError(status.errors[0]);
          errorCode = status.errors[0].code;
        }

        const { data: updatedMessages } = await supabase
          .from("messages")
          .update({ status: status.status, error_detail: errorDetail })
          .eq("wa_message_id", status.id)
          .select("conversation_id");

        // Campaign sends are only ever marked "sent" at API-accept time —
        // this is what later corrects that to the real outcome (delivered,
        // read, or a genuine failure like Meta's ecosystem-health throttling)
        // once the async status webhook actually confirms it.
        await supabase
          .from("campaign_recipients")
          .update({ status: status.status, error_message: errorDetail })
          .eq("wa_message_id", status.id);

        const conversationId = updatedMessages?.[0]?.conversation_id;
        if (!conversationId) continue;

        const { data: conversation } = await supabase
          .from("conversations")
          .select("contact_id")
          .eq("id", conversationId)
          .maybeSingle();
        if (!conversation) continue;

        if (status.status === "failed" && errorCode && UNREACHABLE_ERROR_CODES.has(errorCode)) {
          await recordUnreachableFailure(supabase, conversation.contact_id);
        } else if (status.status === "delivered" || status.status === "read") {
          await resetContactReachability(supabase, conversation.contact_id);
        }

        // Meta reports the same conversation.id on every status update for
        // messages inside that conversation — insert once per conversation,
        // ignoring the duplicate on later delivered/read updates. Only
        // "business_initiated" conversations count against the daily
        // messaging limit tier (250/1K/10K/...); user-initiated ones (a
        // reply within the customer's 24h window) don't.
        if (status.conversation?.id && status.conversation.origin?.type === "business_initiated") {
          await supabase.from("conversation_opens").upsert(
            {
              workspace_id: workspaceId,
              contact_id: conversation.contact_id,
              meta_conversation_id: status.conversation.id,
              origin_type: status.conversation.origin.type,
            },
            { onConflict: "meta_conversation_id", ignoreDuplicates: true }
          );
        }
      }
    }
  }
}
