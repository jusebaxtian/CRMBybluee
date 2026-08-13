"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateMediaMime, validateMediaSize } from "@/lib/whatsapp/media-limits";
import { getWorkspaceId } from "@/lib/workspace";
import { resolveCampaignAudience, type AudienceParams } from "@/lib/campaigns/audience";
import { executeCampaignSend } from "@/lib/campaigns/send";

function readAudienceParams(formData: FormData, sendType: "template" | "free_text"): AudienceParams {
  return {
    includeTagIds: formData.getAll("includeTagIds").map(String).filter(Boolean),
    excludeTagIds: formData.getAll("excludeTagIds").map(String).filter(Boolean),
    createdFromRaw: String(formData.get("createdFrom") ?? "") || null,
    createdToRaw: String(formData.get("createdTo") ?? "") || null,
    // Free-form messages only work within the 24h window — forcing this
    // avoids creating a campaign that would fail on every single recipient.
    audienceWindow:
      sendType === "free_text" ? "open" : (String(formData.get("audienceWindow") ?? "all") as "all" | "open"),
  };
}

// Reads the "send now" vs "schedule for later" choice from the form.
// Returns null (send now, no scheduling) or an ISO string in the future.
function readScheduledAt(formData: FormData): { scheduledAt: string | null; error?: string } {
  const sendMode = String(formData.get("sendMode") ?? "now");
  if (sendMode !== "schedule") return { scheduledAt: null };

  const raw = String(formData.get("scheduledAt") ?? "");
  if (!raw) return { scheduledAt: null, error: "Elige la fecha y hora de envío." };

  const date = new Date(raw);
  if (isNaN(date.getTime())) return { scheduledAt: null, error: "Fecha y hora inválidas." };
  if (date.getTime() <= Date.now()) {
    return { scheduledAt: null, error: "La fecha programada debe ser en el futuro." };
  }
  return { scheduledAt: date.toISOString() };
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

// Lets the campaign form show a live "se enviará a N contactos" count
// before creating anything — same audience resolution the real create/edit
// actions use, so the number never lies.
export async function previewAudienceCount(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const sendType = String(formData.get("sendType") ?? "template") as "template" | "free_text";
  const { contactIds } = await resolveCampaignAudience(supabase, workspaceId, readAudienceParams(formData, sendType));
  return { count: contactIds.length };
}

export async function createCampaign(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sendType = String(formData.get("sendType") ?? "template") as "template" | "free_text";
  const templateId = String(formData.get("templateId") ?? "") || null;
  const messageBody = String(formData.get("messageBody") ?? "").trim() || null;
  const mediaUrl = String(formData.get("mediaUrl") ?? "") || null;
  const mediaFilename = String(formData.get("mediaFilename") ?? "") || null;
  const audienceParams = readAudienceParams(formData, sendType);

  if (!name) return { error: "El nombre es obligatorio." };
  if (sendType === "template" && !templateId) {
    return { error: "Selecciona una plantilla." };
  }
  if (sendType === "free_text" && !messageBody && !mediaUrl) {
    return { error: "Escribe un mensaje o adjunta un archivo." };
  }

  const { scheduledAt, error: scheduleError } = readScheduledAt(formData);
  if (scheduleError) return { error: scheduleError };

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
      audience_tag_ids: audienceParams.includeTagIds.length > 0 ? audienceParams.includeTagIds : null,
      audience_exclude_tag_ids: audienceParams.excludeTagIds.length > 0 ? audienceParams.excludeTagIds : null,
      audience_created_from: audienceParams.createdFromRaw
        ? new Date(audienceParams.createdFromRaw).toISOString()
        : null,
      audience_created_to: audienceParams.createdToRaw
        ? new Date(`${audienceParams.createdToRaw}T23:59:59.999`).toISOString()
        : null,
      audience_window: audienceParams.audienceWindow,
      scheduled_at: scheduledAt,
    })
    .select("id")
    .single();

  if (error || !campaign) return { error: error?.message ?? "Error al crear la campaña." };

  const { contactIds, matchedBeforeWindow } = await resolveCampaignAudience(supabase, workspaceId, audienceParams);

  // Creating a campaign with 0 recipients is never useful and, for
  // free-text sends, almost always means the audience matched contacts
  // but none had an open 24h window (e.g. a freshly imported list that
  // never wrote in) — surface that instead of leaving a silent empty draft.
  if (contactIds.length === 0) {
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    if (matchedBeforeWindow === 0) {
      return {
        error:
          "Ningún contacto coincide con la audiencia elegida (etiquetas/fechas). Revisa los filtros.",
      };
    }
    return {
      error:
        `La audiencia tiene ${matchedBeforeWindow} contacto(s), pero ninguno tiene la ventana de 24h abierta ` +
        "(mensaje libre solo se puede enviar a quien te escribió en las últimas 24h). " +
        "Usa una plantilla aprobada para llegar a contactos que nunca te han escrito, como los que acabas de importar.",
    };
  }

  await supabase.from("campaign_recipients").insert(
    contactIds.map((id) => ({ campaign_id: campaign.id, contact_id: id }))
  );

  redirect(`/dashboard/campaigns/${campaign.id}`);
}

// Edits a still-draft campaign — recomputes the audience from scratch since
// the filters may have changed. Only allowed while status is "draft" (once
// it's sending/completed/failed, editing wouldn't reach anyone new).
export async function updateCampaign(campaignId: string, _prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: existing } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!existing) return { error: "Campaña no encontrada." };
  if (existing.status !== "draft") {
    return { error: "Esta campaña ya no se puede editar porque no está en borrador." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const sendType = String(formData.get("sendType") ?? "template") as "template" | "free_text";
  const templateId = String(formData.get("templateId") ?? "") || null;
  const messageBody = String(formData.get("messageBody") ?? "").trim() || null;
  const mediaUrl = String(formData.get("mediaUrl") ?? "") || null;
  const mediaFilename = String(formData.get("mediaFilename") ?? "") || null;
  const audienceParams = readAudienceParams(formData, sendType);

  if (!name) return { error: "El nombre es obligatorio." };
  if (sendType === "template" && !templateId) {
    return { error: "Selecciona una plantilla." };
  }
  if (sendType === "free_text" && !messageBody && !mediaUrl) {
    return { error: "Escribe un mensaje o adjunta un archivo." };
  }

  const { scheduledAt, error: scheduleError } = readScheduledAt(formData);
  if (scheduleError) return { error: scheduleError };

  const { contactIds, matchedBeforeWindow } = await resolveCampaignAudience(supabase, workspaceId, audienceParams);
  if (contactIds.length === 0) {
    if (matchedBeforeWindow === 0) {
      return {
        error:
          "Ningún contacto coincide con la audiencia elegida (etiquetas/fechas). Revisa los filtros.",
      };
    }
    return {
      error:
        `La audiencia tiene ${matchedBeforeWindow} contacto(s), pero ninguno tiene la ventana de 24h abierta ` +
        "(mensaje libre solo se puede enviar a quien te escribió en las últimas 24h). " +
        "Usa una plantilla aprobada para llegar a contactos que nunca te han escrito.",
    };
  }

  const { error } = await supabase
    .from("campaigns")
    .update({
      name,
      send_type: sendType,
      template_id: sendType === "template" ? templateId : null,
      message_body: sendType === "free_text" ? messageBody : null,
      media_url: sendType === "free_text" ? mediaUrl : null,
      media_filename: sendType === "free_text" ? mediaFilename : null,
      audience_tag_ids: audienceParams.includeTagIds.length > 0 ? audienceParams.includeTagIds : null,
      audience_exclude_tag_ids: audienceParams.excludeTagIds.length > 0 ? audienceParams.excludeTagIds : null,
      audience_created_from: audienceParams.createdFromRaw
        ? new Date(audienceParams.createdFromRaw).toISOString()
        : null,
      audience_created_to: audienceParams.createdToRaw
        ? new Date(`${audienceParams.createdToRaw}T23:59:59.999`).toISOString()
        : null,
      audience_window: audienceParams.audienceWindow,
      scheduled_at: scheduledAt,
    })
    .eq("id", campaignId);
  if (error) return { error: error.message };

  // Recipients are recomputed from scratch — the old list may no longer
  // match the (possibly changed) audience filters.
  await supabase.from("campaign_recipients").delete().eq("campaign_id", campaignId);
  await supabase.from("campaign_recipients").insert(
    contactIds.map((id) => ({ campaign_id: campaignId, contact_id: id }))
  );

  redirect(`/dashboard/campaigns/${campaignId}`);
}

export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: existing } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!existing) return { error: "Campaña no encontrada." };
  if (existing.status !== "draft") {
    return { error: "Solo se pueden eliminar campañas en borrador." };
  }

  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/campaigns");
  redirect("/dashboard/campaigns");
}

export async function sendCampaign(campaignId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No autenticado." };

  const result = await executeCampaignSend(supabase, workspaceId, campaignId);
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return result;
}
