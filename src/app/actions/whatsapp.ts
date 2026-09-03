"use server";

import { revalidatePath } from "next/cache";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForToken,
  subscribeAppToWaba,
  registerPhoneNumber,
  getPhoneNumberDetails,
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  uploadMedia,
} from "@/lib/whatsapp/graph";
import { validateMediaMime, validateMediaSize } from "@/lib/whatsapp/media-limits";
import { transcodeVideoToH264 } from "@/lib/whatsapp/video-transcode";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { buildTemplateSendParams } from "@/lib/whatsapp/variables";
import { resolveSendAccount } from "@/lib/whatsapp/account";

const execFileAsync = promisify(execFile);

// The browser's MediaRecorder produces audio/webm (Chrome/Edge) or
// audio/mp4 (Safari) — WhatsApp's Cloud API only accepts AAC, AMR, MP3,
// MP4 audio, or OGG/Opus (its own voice-note format), so webm recordings
// are silently rejected by Meta. Re-encode to OGG/Opus before sending.
async function transcodeToOggOpus(buffer: Buffer): Promise<Buffer> {
  const id = crypto.randomUUID();
  const inPath = path.join(tmpdir(), `${id}-in.webm`);
  const wavPath = path.join(tmpdir(), `${id}-mid.wav`);
  const outPath = path.join(tmpdir(), `${id}-out.ogg`);
  await writeFile(inPath, buffer);
  try {
    // Two passes: decode fully to a clean PCM WAV first, then encode that to
    // Opus/OGG — encoding straight from the source webm's Opus stream can
    // carry over timestamp/container quirks that Android's lenient player
    // shrugs off but iOS's WhatsApp rejects outright ("ya no disponible").
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inPath,
      "-vn",
      "-ar",
      "48000",
      "-ac",
      "1",
      wavPath,
    ]);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      wavPath,
      "-map_metadata",
      "-1",
      "-c:a",
      "libopus",
      // "voip" tunes Opus for speech instead of generic audio — matches the
      // exact profile WhatsApp's own voice-note recorder uses, which iOS's
      // stricter decoder requires.
      "-application",
      "voip",
      "-b:a",
      "32k",
      "-vbr",
      "on",
      "-compression_level",
      "10",
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(wavPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

function mediaTypeFromMime(mime: string): "image" | "audio" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

export async function connectWhatsApp(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  label?: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: "No se encontró tu workspace." };

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan_id")
    .eq("id", membership.workspace_id)
    .maybeSingle();
  const { data: plan } = workspace?.plan_id
    ? await supabase.from("plans").select("max_whatsapp_numbers").eq("id", workspace.plan_id).maybeSingle()
    : { data: null };
  const maxNumbers = plan?.max_whatsapp_numbers ?? 1;

  const { count: currentCount } = await supabase
    .from("whatsapp_accounts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", membership.workspace_id)
    .neq("status", "frozen");

  // Reconnecting an already-connected number (same phone_number_id) isn't
  // blocked by this — the upsert below finds and updates that row instead
  // of adding a new one, so only a genuinely new number counts against
  // the cap.
  const { data: existingForThisNumber } = await supabase
    .from("whatsapp_accounts")
    .select("id, label")
    .eq("workspace_id", membership.workspace_id)
    .eq("phone_number_id", input.phoneNumberId)
    .maybeSingle();

  if (!existingForThisNumber && (currentCount ?? 0) >= maxNumbers) {
    return {
      error: `Tu plan permite hasta ${maxNumbers} número${maxNumbers === 1 ? "" : "s"} de WhatsApp. Mejora tu plan para conectar más.`,
    };
  }

  try {
    const accessToken = await exchangeCodeForToken(input.code);
    await subscribeAppToWaba(input.wabaId, accessToken);
    // Required for the number to actually send/receive via the Cloud API —
    // Embedded Signup's own verification alone isn't enough (see comment on
    // registerPhoneNumber). Best-effort: some numbers arrive already
    // registered and this call 4xxs on those; not worth failing the whole
    // connection over.
    try {
      await registerPhoneNumber(input.phoneNumberId, accessToken);
    } catch (err) {
      console.error("registerPhoneNumber failed (continuing):", err);
    }
    const phoneDetails = await getPhoneNumberDetails(
      input.phoneNumberId,
      accessToken
    );

    const { error } = await supabase.from("whatsapp_accounts").upsert(
      {
        workspace_id: membership.workspace_id,
        waba_id: input.wabaId,
        phone_number_id: input.phoneNumberId,
        display_phone_number: phoneDetails.display_phone_number,
        access_token: accessToken,
        status: "connected",
        // Reconnecting (e.g. a token refresh) doesn't necessarily pass a
        // label again — keep whatever was already set instead of wiping it.
        label: input.label?.trim() || existingForThisNumber?.label || null,
      },
      // "workspace_id" alone used to be the unique key (one number per
      // workspace) — now it's (workspace_id, phone_number_id), since a
      // workspace can hold multiple numbers (see 0066 migration).
      // Reconnecting the SAME number still updates its existing row; a
      // genuinely new number inserts a new one instead of overwriting the
      // workspace's only row like before.
      { onConflict: "workspace_id,phone_number_id" }
    );

    if (error) return { error: error.message };

    revalidatePath("/dashboard");
    return { success: true, displayPhoneNumber: phoneDetails.display_phone_number };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function disconnectWhatsApp(password: string, accountId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    return { error: "No tienes permiso para desconectar WhatsApp." };
  }

  if (!password) return { error: "Ingresa tu contraseña para confirmar." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "No se pudo verificar tu sesión." };

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) return { error: "Contraseña incorrecta." };

  const { error } = await supabase
    .from("whatsapp_accounts")
    .delete()
    .eq("id", accountId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function renameWhatsAppAccount(accountId: string, label: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("whatsapp_accounts")
    .update({ label: label.trim() || null })
    .eq("id", accountId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

async function sendToConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  workspaceId: string,
  contactWaId: string,
  body: string,
  replyToWaMessageId?: string,
  whatsappAccountId?: string | null
) {
  const account = await resolveSendAccount(supabase, workspaceId, whatsappAccountId);

  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  try {
    const result = await sendTextMessage(
      account.phone_number_id,
      account.access_token,
      contactWaId,
      body,
      replyToWaMessageId
    );

    // Independent writes — no need to wait on one before starting the other.
    await Promise.all([
      supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: "text",
        body,
        wa_message_id: result.messages[0]?.id,
        context_wa_message_id: replyToWaMessageId ?? null,
        status: "sent",
        // Flags this as a human agent actively answering — campaigns skip a
        // contact with a recent sent_by_support message so a mass send
        // doesn't interrupt a conversation someone's live in right now.
        sent_by_support: true,
      }),
      supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId),
    ]);

    revalidatePath(`/dashboard/inbox/${conversationId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true as const, conversationId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function sendChatMedia(formData: FormData) {
  const supabase = await createClient();

  const conversationId = String(formData.get("conversationId") ?? "");
  const file = formData.get("file") as File | null;
  if (!conversationId || !file || file.size === 0) {
    return { error: "Adjunta un archivo." };
  }

  const [
    {
      data: { user },
    },
    { data: conversation },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("conversations")
      .select("id, workspace_id, whatsapp_account_id, contacts(wa_id)")
      .eq("id", conversationId)
      .single(),
  ]);
  if (!user) return { error: "No autenticado." };

  if (!conversation) return { error: "Conversación no encontrada." };

  const account = await resolveSendAccount(
    supabase,
    conversation.workspace_id,
    conversation.whatsapp_account_id
  );

  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  const contactWaId = (conversation.contacts as unknown as { wa_id: string }).wa_id;
  const mediaType = mediaTypeFromMime(file.type);

  // Catches an oversized/unsupported file synchronously, before spending an
  // upload on it — without this, WhatsApp accepts the send and only rejects
  // it later via the async status webhook, days removed from the moment the
  // agent picked the file (see friendlyWhatsAppError in ingest.ts). Webm
  // audio and video are exempt from the size check here — both get
  // transcoded below, so their real final size is only known afterward.
  const isWebmAudio = mediaType === "audio" && file.type.includes("webm");
  const mimeError = isWebmAudio ? null : validateMediaMime(mediaType, file.type);
  if (mimeError) return { error: "No se pudo enviar: " + mimeError };
  if (mediaType !== "video") {
    const sizeError = validateMediaSize(mediaType, file.size);
    if (sizeError) return { error: "No se pudo enviar: " + sizeError };
  }

  let uploadBuffer: Buffer | File = file;
  let uploadContentType = file.type;
  let uploadFilename = file.name;

  // Only webm needs converting — WhatsApp already accepts the other formats
  // browsers might produce (e.g. Safari's audio/mp4).
  if (mediaType === "audio" && file.type.includes("webm")) {
    try {
      const original = Buffer.from(await file.arrayBuffer());
      uploadBuffer = await transcodeToOggOpus(original);
      // WhatsApp's media-link fetcher matches the Content-Type header against
      // its supported-format allowlist exactly — "audio/ogg; codecs=opus" (a
      // valid MIME type in general) doesn't match their "audio/ogg" entry, so
      // the message gets silently marked "failed" after Meta downloads it.
      uploadContentType = "audio/ogg";
      uploadFilename = file.name.replace(/\.webm$/i, ".ogg");
    } catch (err) {
      return {
        error:
          "No se pudo procesar la nota de voz: " +
          (err instanceof Error ? err.message : "error desconocido"),
      };
    }
  }

  // Every video gets normalized to H.264/AAC regardless of source
  // codec/container — see the comment on transcodeVideoToH264 for why.
  if (mediaType === "video") {
    try {
      const original = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "mp4";
      uploadBuffer = await transcodeVideoToH264(original, ext);
      uploadContentType = "video/mp4";
      uploadFilename = file.name.replace(/\.[^.]+$/, "") + ".mp4";
    } catch (err) {
      return {
        error:
          "No se pudo procesar el video: " +
          (err instanceof Error ? err.message : "error desconocido"),
      };
    }

    const sizeError = validateMediaSize("video", (uploadBuffer as Buffer).length);
    if (sizeError) return { error: "No se pudo enviar: " + sizeError };
  }

  const admin = createAdminClient();
  const storagePath = `${conversation.workspace_id}/${conversationId}/${Date.now()}-${uploadFilename}`;

  // Every media type is sent by uploaded media id, not by link — link-based
  // sends make Meta fetch the file back from our own storage over HTTP, and
  // any blip on that fetch fails the send outright (confirmed in
  // production for campaigns: a burst of "DNS resolution timed out"
  // failures under load — audio specifically can even show "delivered"
  // while leaving an unplayable voice note; see uploadMedia's comment).
  // Neither upload depends on the other's result, so run them together.
  const metaBuffer = Buffer.isBuffer(uploadBuffer)
    ? uploadBuffer
    : Buffer.from(await (uploadBuffer as File).arrayBuffer());

  const [{ error: uploadError }, metaMediaId] = await Promise.all([
    admin.storage.from("chat-media").upload(storagePath, uploadBuffer, { contentType: uploadContentType }),
    uploadMedia(account.phone_number_id, account.access_token, metaBuffer, uploadContentType, uploadFilename).catch(
      (err) => {
        console.error("media pre-upload to Meta failed, falling back to link:", err);
        return null;
      }
    ),
  ]);
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(storagePath);

  try {
    const source = metaMediaId ? { id: metaMediaId } : { link: publicUrl };

    const result = await sendMediaMessage(
      account.phone_number_id,
      account.access_token,
      contactWaId,
      mediaType,
      source,
      uploadFilename
    );

    await Promise.all([
      supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: mediaType,
        body: mediaType === "document" ? uploadFilename : null,
        media_url: publicUrl,
        media_mime_type: uploadContentType,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
        sent_by_support: true,
      }),
      supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId),
    ]);

    revalidatePath(`/dashboard/inbox/${conversationId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function sendMessage(input: {
  conversationId: string;
  body: string;
  replyToWaMessageId?: string;
}) {
  const supabase = await createClient();

  // Independent reads — run them together instead of one after another.
  const [
    {
      data: { user },
    },
    { data: conversation },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("conversations")
      .select("id, workspace_id, whatsapp_account_id, contacts(wa_id)")
      .eq("id", input.conversationId)
      .single(),
  ]);
  if (!user) return { error: "No autenticado." };

  if (!conversation) return { error: "Conversación no encontrada." };

  const contactWaId = (conversation.contacts as unknown as { wa_id: string }).wa_id;

  return sendToConversation(
    supabase,
    conversation.id,
    conversation.workspace_id,
    contactWaId,
    input.body,
    input.replyToWaMessageId,
    conversation.whatsapp_account_id
  );
}

export async function sendMessageToContact(input: { contactId: string; body: string }) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, wa_id")
    .eq("id", input.contactId)
    .single();
  if (!contact) return { error: "Contacto no encontrado." };

  // Leaving whatsapp_account_id unset on a freshly-created conversation used
  // to leave it null forever — silently breaking every future inbound reply
  // from this contact (ingest.ts's upsert targets a 3-column unique
  // constraint including whatsapp_account_id; a null value on the existing
  // row doesn't match a non-null value being upserted there, so it collides
  // with the OTHER unique constraint instead). Resolving it here and using
  // the plain 2-column conflict target (never the 3-column one) avoids that.
  const account = await resolveSendAccount(supabase, workspaceId, null);

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .upsert(
      {
        workspace_id: workspaceId,
        contact_id: contact.id,
        ...(account ? { whatsapp_account_id: account.id } : {}),
      },
      { onConflict: "workspace_id,contact_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (convError || !conversation) {
    return { error: convError?.message ?? "No se pudo abrir la conversación." };
  }

  return sendToConversation(supabase, conversation.id, workspaceId, contact.wa_id, input.body);
}

// Templates are the only message type WhatsApp allows outside the 24h
// customer-service window, so this is what the composer falls back to once
// that window closes.
export async function sendTemplateToConversation(input: {
  conversationId: string;
  templateId: string;
}) {
  const supabase = await createClient();

  const [{ data: conversation }, { data: template }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, workspace_id, whatsapp_account_id, contacts(wa_id, name)")
      .eq("id", input.conversationId)
      .single(),
    supabase
      .from("templates")
      .select("meta_template_name, language, body_text, header_format, header_media_url, variable_count, buttons")
      .eq("id", input.templateId)
      .single(),
  ]);

  if (!conversation) return { error: "Conversación no encontrada." };
  if (!template) return { error: "Plantilla no encontrada." };

  const account = await resolveSendAccount(
    supabase,
    conversation.workspace_id,
    conversation.whatsapp_account_id
  );
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  const contact = conversation.contacts as unknown as { wa_id: string; name: string | null };

  const headerFormat = template.header_format as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  const headerMedia =
    headerFormat && headerFormat !== "TEXT" && template.header_media_url
      ? {
          type: headerFormat.toLowerCase() as "image" | "video" | "document",
          link: template.header_media_url,
        }
      : undefined;

  try {
    const { bodyParams, buttonUrlParam } = buildTemplateSendParams(template, contact);
    const result = await sendTemplateMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      template.meta_template_name,
      template.language,
      bodyParams,
      headerMedia,
      buttonUrlParam
    );

    await Promise.all([
      supabase.from("messages").insert({
        conversation_id: input.conversationId,
        direction: "out",
        message_type: headerMedia ? headerMedia.type : "template",
        body: template.body_text || `[Plantilla: ${template.meta_template_name}]`,
        media_url: headerMedia?.link ?? null,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
        sent_by_support: true,
      }),
      supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", input.conversationId),
    ]);

    revalidatePath(`/dashboard/inbox/${input.conversationId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

// The Dataset ID from Events Manager that Click-to-WhatsApp Conversions API
// events get sent to — see src/lib/meta/conversions.ts for where it's used.
export async function saveCtwaDatasetId(datasetId: string, accountId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("whatsapp_accounts")
    .update({ ctwa_dataset_id: datasetId.trim() || null })
    .eq("id", accountId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}
