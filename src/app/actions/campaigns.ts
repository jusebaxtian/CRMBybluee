"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplateMessage, sendTextMessage, sendMediaMessage } from "@/lib/whatsapp/graph";
import { mediaKindFromMime, validateMediaMime, validateMediaSize } from "@/lib/whatsapp/media-limits";
import { getWorkspaceId } from "@/lib/workspace";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Contacts whose most recent inbound message is still within the 24h
// window — i.e. WhatsApp will accept a free-form (non-template) message to
// them right now. Loads every conversation for the given contacts and their
// most recent inbound message, same approach the inbox list uses.
async function filterContactsWithOpenWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  contactIds: string[]
): Promise<string[]> {
  if (contactIds.length === 0) return [];

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .eq("workspace_id", workspaceId)
    .in("contact_id", contactIds);
  if (!conversations || conversations.length === 0) return [];

  const conversationIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, created_at")
    .in("conversation_id", conversationIds)
    .eq("direction", "in")
    .order("created_at", { ascending: false });

  const lastInboundByConversation = new Map<string, string>();
  for (const m of messages ?? []) {
    if (!lastInboundByConversation.has(m.conversation_id)) {
      lastInboundByConversation.set(m.conversation_id, m.created_at);
    }
  }

  const now = Date.now();
  const openContactIds = new Set<string>();
  for (const c of conversations) {
    const lastInboundAt = lastInboundByConversation.get(c.id);
    if (lastInboundAt && now - new Date(lastInboundAt).getTime() < WINDOW_MS) {
      openContactIds.add(c.contact_id);
    }
  }

  return contactIds.filter((id) => openContactIds.has(id));
}

export async function uploadCampaignMedia(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const file = formData.get("file") as File | null;
  const mediaKind = String(formData.get("mediaKind") ?? "") as "image" | "video" | "document";
  if (!file || file.size === 0) return { error: "Selecciona un archivo." };

  const mimeError = validateMediaMime(mediaKind, file.type);
  if (mimeError) return { error: mimeError };
  const sizeError = validateMediaSize(mediaKind, file.size);
  if (sizeError) return { error: sizeError };

  const admin = createAdminClient();
  const path = `${workspaceId}/campaigns/${Date.now()}-${file.name}`;

  const { error } = await admin.storage.from("chat-media").upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);

  return { success: true as const, url: publicUrl, filename: file.name };
}

export async function createCampaign(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sendType = String(formData.get("sendType") ?? "template") as "template" | "free_text";
  const templateId = String(formData.get("templateId") ?? "") || null;
  const messageBody = String(formData.get("messageBody") ?? "").trim() || null;
  const mediaUrl = String(formData.get("mediaUrl") ?? "") || null;
  const mediaFilename = String(formData.get("mediaFilename") ?? "") || null;
  const audienceTagId = String(formData.get("audienceTagId") ?? "") || null;
  // Free-form messages only work within the 24h window — forcing this
  // avoids creating a campaign that would fail on every single recipient.
  const audienceWindow =
    sendType === "free_text" ? "open" : (String(formData.get("audienceWindow") ?? "all") as "all" | "open");

  if (!name) return { error: "El nombre es obligatorio." };
  if (sendType === "template" && !templateId) {
    return { error: "Selecciona una plantilla." };
  }
  if (sendType === "free_text" && !messageBody && !mediaUrl) {
    return { error: "Escribe un mensaje o adjunta un archivo." };
  }

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      name,
      send_type: sendType,
      template_id: sendType === "template" ? templateId : null,
      message_body: sendType === "free_text" ? messageBody : null,
      media_url: sendType === "free_text" ? mediaUrl : null,
      media_filename: sendType === "free_text" ? mediaFilename : null,
      audience_tag_id: audienceTagId,
      audience_window: audienceWindow,
    })
    .select("id")
    .single();

  if (error || !campaign) return { error: error?.message ?? "Error al crear la campaña." };

  let contactsQuery = supabase.from("contacts").select("id").eq("workspace_id", workspaceId);
  if (audienceTagId) {
    const { data: taggedContacts } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", audienceTagId);
    const ids = (taggedContacts ?? []).map((c) => c.contact_id);
    contactsQuery = contactsQuery.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: contacts } = await contactsQuery;
  let contactIds = (contacts ?? []).map((c) => c.id);

  if (audienceWindow === "open") {
    contactIds = await filterContactsWithOpenWindow(supabase, workspaceId, contactIds);
  }

  if (contactIds.length > 0) {
    await supabase.from("campaign_recipients").insert(
      contactIds.map((id) => ({ campaign_id: campaign.id, contact_id: id }))
    );
  }

  redirect(`/dashboard/campaigns/${campaign.id}`);
}

async function getOrCreateConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  contactId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .upsert({ workspace_id: workspaceId, contact_id: contactId }, { onConflict: "workspace_id,contact_id" })
    .select("id")
    .single();
  return data?.id ?? null;
}

export async function sendCampaign(campaignId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No autenticado." };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, send_type, message_body, media_url, media_filename, templates(meta_template_name, language)")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { error: "Campaña no encontrada." };

  const template = campaign.templates as unknown as { meta_template_name: string; language: string } | null;

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", workspaceId)
    .single();
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaignId);

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, contact_id, contacts(wa_id)")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  let failures = 0;
  const mediaKind = campaign.media_url ? mediaKindFromMime(guessMimeFromFilename(campaign.media_filename)) : null;

  for (const recipient of recipients ?? []) {
    const waId = (recipient.contacts as unknown as { wa_id: string }).wa_id;
    try {
      if (campaign.send_type === "template" && template) {
        const result = await sendTemplateMessage(
          account.phone_number_id,
          account.access_token,
          waId,
          template.meta_template_name,
          template.language
        );
        await supabase
          .from("campaign_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", recipient.id);
        void result;
      } else {
        // Free-form send — re-check the window right before sending, since
        // it may have closed since the campaign was created.
        const conversationId = await getOrCreateConversation(supabase, workspaceId, recipient.contact_id);
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

        let result;
        if (campaign.media_url && mediaKind) {
          result = await sendMediaMessage(
            account.phone_number_id,
            account.access_token,
            waId,
            mediaKind,
            { link: campaign.media_url },
            campaign.media_filename ?? undefined,
            mediaKind !== "audio" ? campaign.message_body ?? undefined : undefined
          );
        } else {
          result = await sendTextMessage(
            account.phone_number_id,
            account.access_token,
            waId,
            campaign.message_body ?? ""
          );
        }

        if (conversationId) {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            direction: "out",
            message_type: mediaKind ?? "text",
            body: campaign.message_body,
            media_url: campaign.media_url,
            wa_message_id: result.messages[0]?.id,
            status: "sent",
          });
          await supabase
            .from("conversations")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", conversationId);
        }

        await supabase
          .from("campaign_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
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

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return { success: true };
}

// media_filename doesn't carry a mime type — infer a close-enough one from
// its extension just to pick the right WhatsApp media kind (image/video/
// document) for sending; this never touches file content or validation.
function guessMimeFromFilename(filename: string | null): string {
  const ext = (filename ?? "").split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "mp4") return "video/mp4";
  return "application/pdf";
}
