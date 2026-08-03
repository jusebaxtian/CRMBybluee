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
  getPhoneNumberDetails,
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  uploadMedia,
} from "@/lib/whatsapp/graph";
import { validateMediaMime, validateMediaSize } from "@/lib/whatsapp/media-limits";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";

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

  try {
    const accessToken = await exchangeCodeForToken(input.code);
    await subscribeAppToWaba(input.wabaId, accessToken);
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
      },
      { onConflict: "workspace_id" }
    );

    if (error) return { error: error.message };

    revalidatePath("/dashboard");
    return { success: true, displayPhoneNumber: phoneDetails.display_phone_number };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function disconnectWhatsApp(password: string) {
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
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

async function sendToConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  workspaceId: string,
  contactWaId: string,
  body: string
) {
  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", workspaceId)
    .single();

  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  try {
    const result = await sendTextMessage(
      account.phone_number_id,
      account.access_token,
      contactWaId,
      body
    );

    // Independent writes — no need to wait on one before starting the other.
    await Promise.all([
      supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: "text",
        body,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
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
      .select("id, workspace_id, contacts(wa_id)")
      .eq("id", conversationId)
      .single(),
  ]);
  if (!user) return { error: "No autenticado." };

  if (!conversation) return { error: "Conversación no encontrada." };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", conversation.workspace_id)
    .single();

  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  const contactWaId = (conversation.contacts as unknown as { wa_id: string }).wa_id;
  const mediaType = mediaTypeFromMime(file.type);

  // Catches an oversized/unsupported file synchronously, before spending an
  // upload on it — without this, WhatsApp accepts the send and only rejects
  // it later via the async status webhook, days removed from the moment the
  // agent picked the file (see friendlyWhatsAppError in ingest.ts). Webm
  // audio is exempt from the mime check — it gets transcoded to ogg/opus
  // right below, which IS an allowed mime; only its size is checked here.
  const isWebmAudio = mediaType === "audio" && file.type.includes("webm");
  const validationError =
    (isWebmAudio ? null : validateMediaMime(mediaType, file.type)) ??
    validateMediaSize(mediaType, file.size);
  if (validationError) return { error: "No se pudo enviar: " + validationError };

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

  const admin = createAdminClient();
  const storagePath = `${conversation.workspace_id}/${conversationId}/${Date.now()}-${uploadFilename}`;

  // Audio specifically is sent by uploaded media id, not by link — see the
  // comment on uploadMedia for why (link-based audio can show "delivered"
  // yet be unplayable for the recipient). Neither upload depends on the
  // other's result, so run them together instead of one after another.
  const metaBuffer =
    mediaType === "audio"
      ? Buffer.isBuffer(uploadBuffer)
        ? uploadBuffer
        : Buffer.from(await (uploadBuffer as File).arrayBuffer())
      : null;

  const [{ error: uploadError }, metaMediaId] = await Promise.all([
    admin.storage.from("chat-media").upload(storagePath, uploadBuffer, { contentType: uploadContentType }),
    metaBuffer
      ? uploadMedia(account.phone_number_id, account.access_token, metaBuffer, uploadContentType, uploadFilename)
      : Promise.resolve(null),
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

export async function sendMessage(input: { conversationId: string; body: string }) {
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
      .select("id, workspace_id, contacts(wa_id)")
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
    input.body
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

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .upsert(
      { workspace_id: workspaceId, contact_id: contact.id },
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
      .select("id, workspace_id, contacts(wa_id)")
      .eq("id", input.conversationId)
      .single(),
    supabase
      .from("templates")
      .select("meta_template_name, language, body_text")
      .eq("id", input.templateId)
      .single(),
  ]);

  if (!conversation) return { error: "Conversación no encontrada." };
  if (!template) return { error: "Plantilla no encontrada." };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", conversation.workspace_id)
    .single();
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  const contactWaId = (conversation.contacts as unknown as { wa_id: string }).wa_id;

  try {
    const result = await sendTemplateMessage(
      account.phone_number_id,
      account.access_token,
      contactWaId,
      template.meta_template_name,
      template.language
    );

    await Promise.all([
      supabase.from("messages").insert({
        conversation_id: input.conversationId,
        direction: "out",
        message_type: "template",
        body: template.body_text || `[Plantilla: ${template.meta_template_name}]`,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
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
