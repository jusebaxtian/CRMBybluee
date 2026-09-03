import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplateMessage, sendTextMessage, sendMediaMessage, uploadMedia } from "@/lib/whatsapp/graph";
import { mediaKindFromMime } from "@/lib/whatsapp/media-limits";
import { substituteContactVariables, buildTemplateSendParams } from "@/lib/whatsapp/variables";
import { resolveSendAccount } from "@/lib/whatsapp/account";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// media_filename doesn't carry a mime type — infer a close-enough one from
// its extension just to pick the right WhatsApp media kind (image/video/
// audio/document) for sending; this never touches file content or
// validation, only which sendMediaMessage(type) call gets made.
function guessMimeFromFilename(filename: string | null): string {
  const ext = (filename ?? "").toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    amr: "audio/amr",
    aac: "audio/aac",
  };
  return map[ext] ?? "application/pdf";
}

// Not setting whatsapp_account_id here used to leave it null forever on a
// freshly-created conversation, which silently broke every future inbound
// reply from that contact — ingest.ts's own upsert targets a 3-column
// unique constraint including whatsapp_account_id, and a null value on the
// existing row doesn't match the non-null value being upserted there, so
// Postgres collides with the OTHER unique constraint on just
// (workspace_id, contact_id) instead. The campaign's own send account is
// already known here (unlike ingest.ts, no extra resolveSendAccount lookup
// needed per recipient), and this uses the plain 2-column conflict target,
// never the 3-column one, so no such collision is possible either way.
async function getOrCreateConversation(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  whatsappAccountId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .upsert(
      { workspace_id: workspaceId, contact_id: contactId, whatsapp_account_id: whatsappAccountId },
      { onConflict: "workspace_id,contact_id" }
    )
    .select("id")
    .single();
  return data?.id ?? null;
}

type PreparedCampaignSend = {
  campaign: {
    id: string;
    send_type: string;
    message_body: string | null;
    media_url: string | null;
    media_filename: string | null;
    whatsapp_account_id: string | null;
  };
  template: {
    meta_template_name: string;
    language: string;
    body_text: string | null;
    header_format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    header_media_url: string | null;
    header_media_mime_type: string | null;
    variable_count: number;
    buttons: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  } | null;
  templateHeaderMedia: { type: "image" | "video" | "document"; link: string } | undefined;
  account: NonNullable<Awaited<ReturnType<typeof resolveSendAccount>>>;
};

// The fast part: fetch the campaign, resolve which number sends it, and flip
// its status to "sending". Split out from the (potentially long-running,
// thousands of recipients) send loop below so a caller can await just this
// part quickly and return, then run the actual sending in the background
// instead of holding an HTTP request open the whole time — see
// startCampaignSend, used by the manual "Enviar" button.
async function prepareCampaignSend(
  supabase: SupabaseClient,
  workspaceId: string,
  campaignId: string
): Promise<{ error: string } | { data: PreparedCampaignSend }> {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, send_type, message_body, media_url, media_filename, whatsapp_account_id, templates(meta_template_name, language, body_text, header_format, header_media_url, header_media_mime_type, variable_count, buttons)"
    )
    .eq("id", campaignId)
    .single();
  if (!campaign) return { error: "Campaña no encontrada." };

  const template = campaign.templates as unknown as PreparedCampaignSend["template"];

  const templateHeaderMedia =
    template?.header_format &&
    template.header_format !== "TEXT" &&
    template.header_media_url
      ? {
          type: template.header_format.toLowerCase() as "image" | "video" | "document",
          link: template.header_media_url,
        }
      : undefined;

  const account = await resolveSendAccount(supabase, workspaceId, campaign.whatsapp_account_id);
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaignId);

  return { data: { campaign, template, templateHeaderMedia, account } };
}

// The slow part: actually sends to every recipient, one at a time. Shared
// by the manual "Enviar" button (called in the background, not awaited by
// the request that triggered it) and the scheduler tick (already
// server-side, no HTTP request to hold open) — both need the exact same
// send/record-keeping logic, just triggered and awaited differently.
async function runCampaignSendLoop(
  supabase: SupabaseClient,
  workspaceId: string,
  campaignId: string,
  prepared: PreparedCampaignSend
): Promise<{ error: string } | { success: true }> {
  const { campaign, template, templateHeaderMedia, account } = prepared;

  // PostgREST hard-caps any single response (table select OR an RPC
  // returning a table) at 1000 rows — a campaign with more than 1000
  // pending recipients used to have only the first 1000 actually sent,
  // silently, no error. Page through with .range() until a batch comes
  // back short, same fix as resolveCampaignAudience.
  type RecipientRow = {
    id: string;
    contact_id: string;
    contacts: { wa_id: string; name: string | null; likely_blocked: boolean };
  };
  const PAGE_SIZE = 1000;
  const recipients: RecipientRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: batch } = await supabase
      .from("campaign_recipients")
      .select("id, contact_id, contacts(wa_id, name, likely_blocked)")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .range(offset, offset + PAGE_SIZE - 1);
    if (!batch || batch.length === 0) break;
    recipients.push(...(batch as unknown as RecipientRow[]));
    if (batch.length < PAGE_SIZE) break;
  }

  // Last-line guard, independent of whatever the audience filters computed
  // at creation time: a contact carrying any "excludes_followups" tag must
  // never receive a mass send, no exceptions — covers both campaigns
  // created before this rule existed and a contact getting tagged after
  // the campaign was already built (e.g. a scheduled send). Resolved via a
  // campaign_id-scoped RPC rather than an `?contact_id=in.(...)` list — a
  // large recipient list can build a query string long enough to trip
  // nginx's URL-length limit (silently returns no rows, not an error).
  const noFollowupContactIds = new Set<string>();
  // A contact an agent replied to (manually, from the chat) in the last 15
  // minutes is being talked to right now — skip them so the campaign
  // doesn't interrupt that conversation. Same reasoning/pattern as the
  // no-followup exclusion above.
  const activeChatContactIds = new Set<string>();
  if (recipients.length > 0) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: excluded } = await supabase
        .rpc("campaign_no_followup_recipient_ids", { p_campaign_id: campaignId })
        .range(offset, offset + PAGE_SIZE - 1);
      const batch = (excluded ?? []) as { contact_id: string }[];
      for (const row of batch) noFollowupContactIds.add(row.contact_id);
      if (batch.length < PAGE_SIZE) break;
    }
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: activeChats } = await supabase
        .rpc("campaign_active_chat_recipient_ids", { p_campaign_id: campaignId })
        .range(offset, offset + PAGE_SIZE - 1);
      const batch = (activeChats ?? []) as { contact_id: string }[];
      for (const row of batch) activeChatContactIds.add(row.contact_id);
      if (batch.length < PAGE_SIZE) break;
    }
  }

  let failures = 0;
  const mediaKind = campaign.media_url ? mediaKindFromMime(guessMimeFromFilename(campaign.media_filename)) : null;

  // Sending by { link } makes Meta re-fetch the file over HTTP for EVERY
  // recipient — with dozens of recipients that's dozens of independent
  // fetches back to our own server, and any blip (confirmed in production:
  // Meta returning "DNS resolution timed out" on a chunk of them, not all —
  // classic overload/flakiness, not a real DNS outage) fails that one send
  // outright. Uploading once and sending by { id } instead means Meta only
  // ever fetches the file once, then serves its own stored copy to every
  // recipient — eliminates this whole failure mode.
  let mediaId: string | null = null;
  if (campaign.media_url && mediaKind) {
    try {
      const fileRes = await fetch(campaign.media_url);
      if (!fileRes.ok) throw new Error(`No se pudo descargar el adjunto (${fileRes.status}).`);
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const mimeType = fileRes.headers.get("content-type") ?? "application/octet-stream";
      mediaId = await uploadMedia(
        account.phone_number_id,
        account.access_token,
        buffer,
        mimeType,
        campaign.media_filename ?? "archivo"
      );
    } catch (err) {
      console.error(`campaign ${campaignId}: media pre-upload failed, falling back to link:`, err);
    }
  }

  for (const recipient of recipients ?? []) {
    const contact = recipient.contacts as unknown as {
      wa_id: string;
      name: string | null;
      likely_blocked: boolean;
    };
    const { wa_id: waId, likely_blocked: likelyBlocked } = contact;

    if (noFollowupContactIds.has(recipient.contact_id)) {
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
          error_message: "Contacto tiene una etiqueta de \"no seguimientos\" — excluido de envíos masivos.",
        })
        .eq("id", recipient.id);
      continue;
    }

    if (activeChatContactIds.has(recipient.contact_id)) {
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
          error_message: "Un agente le está respondiendo en este momento — excluido para no interrumpir la conversación.",
        })
        .eq("id", recipient.id);
      continue;
    }

    // Re-check right before sending — a contact could have started failing
    // (and gotten flagged) after this campaign was created.
    if (likelyBlocked) {
      failures += 1;
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
          error_message: "Contacto marcado como posiblemente bloqueado — no se le envió.",
        })
        .eq("id", recipient.id);
      continue;
    }
    try {
      if (campaign.send_type === "template" && template) {
        const { bodyParams, buttonUrlParam } = buildTemplateSendParams(template, contact);
        const result = await sendTemplateMessage(
          account.phone_number_id,
          account.access_token,
          waId,
          template.meta_template_name,
          template.language,
          bodyParams,
          templateHeaderMedia,
          buttonUrlParam
        );

        const conversationId = await getOrCreateConversation(supabase, workspaceId, recipient.contact_id, account.id);
        if (conversationId) {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            direction: "out",
            message_type: templateHeaderMedia ? templateHeaderMedia.type : "template",
            body: template.body_text,
            media_url: templateHeaderMedia?.link ?? null,
            wa_message_id: result.messages[0]?.id,
            status: "sent",
            exclude_from_followups: true,
          });
          await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
        }

        await supabase
          .from("campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            wa_message_id: result.messages[0]?.id,
          })
          .eq("id", recipient.id);
      } else {
        // Free-form send — re-check the window right before sending, since
        // it may have closed since the campaign was created.
        const conversationId = await getOrCreateConversation(supabase, workspaceId, recipient.contact_id, account.id);
        const { data: lastInbound } = await supabase
          .from("messages")
          .select("created_at")
          .eq("conversation_id", conversationId ?? "")
          .eq("direction", "in")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const windowOpen =
          !!lastInbound && Date.now() - new Date(lastInbound.created_at).getTime() < WINDOW_MS;
        if (!windowOpen) {
          throw new Error("La ventana de 24h se cerró para este contacto antes del envío.");
        }

        const personalizedBody = campaign.message_body
          ? substituteContactVariables(campaign.message_body, contact)
          : campaign.message_body;

        let result;
        if (campaign.media_url && mediaKind) {
          result = await sendMediaMessage(
            account.phone_number_id,
            account.access_token,
            waId,
            mediaKind,
            mediaId ? { id: mediaId } : { link: campaign.media_url },
            campaign.media_filename ?? undefined,
            mediaKind !== "audio" ? personalizedBody ?? undefined : undefined
          );
        } else {
          result = await sendTextMessage(
            account.phone_number_id,
            account.access_token,
            waId,
            personalizedBody ?? ""
          );
        }

        if (conversationId) {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            direction: "out",
            message_type: mediaKind ?? "text",
            body: personalizedBody,
            media_url: campaign.media_url,
            wa_message_id: result.messages[0]?.id,
            status: "sent",
            // Mass campaigns run fully independent of follow-up sequences —
            // this must not cancel/reset/start one (see the DB trigger).
            exclude_from_followups: true,
          });
          await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
        }

        await supabase
          .from("campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            wa_message_id: result.messages[0]?.id,
          })
          .eq("id", recipient.id);
      }
    } catch (err) {
      failures += 1;
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Error desconocido.",
        })
        .eq("id", recipient.id);
    }
  }

  await supabase
    .from("campaigns")
    .update({ status: failures > 0 && recipients?.length === failures ? "failed" : "completed" })
    .eq("id", campaignId);

  return { success: true };
}

// Used by the scheduler tick — already running server-side with no HTTP
// request to hold open, so it just awaits the whole thing start to finish
// like before.
export async function executeCampaignSend(
  supabase: SupabaseClient,
  workspaceId: string,
  campaignId: string
): Promise<{ error: string } | { success: true }> {
  const prepared = await prepareCampaignSend(supabase, workspaceId, campaignId);
  if ("error" in prepared) return prepared;
  return runCampaignSendLoop(supabase, workspaceId, campaignId, prepared.data);
}

// Used by the manual "Enviar" button. Awaits only the fast part (campaign
// lookup, resolving which number sends it, flipping status to "sending") so
// real setup errors ("no WhatsApp conectado") still come back to the
// button immediately — then fires the actual send loop WITHOUT awaiting it,
// so a campaign with thousands of recipients doesn't hold the browser's
// request open long enough to hit nginx's 180s proxy timeout. The loop
// keeps running server-side after this function returns; progress is
// visible via each recipient's status in the campaign detail page.
export async function startCampaignSend(
  supabase: SupabaseClient,
  workspaceId: string,
  campaignId: string
): Promise<{ error: string } | { success: true; background: true }> {
  const prepared = await prepareCampaignSend(supabase, workspaceId, campaignId);
  if ("error" in prepared) return prepared;

  runCampaignSendLoop(supabase, workspaceId, campaignId, prepared.data).catch((err) => {
    console.error(`campaign ${campaignId}: background send loop failed:`, err);
  });

  return { success: true, background: true };
}
