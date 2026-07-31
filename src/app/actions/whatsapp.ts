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
} from "@/lib/whatsapp/graph";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";

const execFileAsync = promisify(execFile);

// The browser's MediaRecorder produces audio/webm (Chrome/Edge) or
// audio/mp4 (Safari) — WhatsApp's Cloud API only accepts AAC, AMR, MP3,
// MP4 audio, or OGG/Opus (its own voice-note format), so webm recordings
// are silently rejected by Meta. Re-encode to OGG/Opus before sending.
async function transcodeToOggOpus(buffer: Buffer): Promise<Buffer> {
  const id = crypto.randomUUID();
  const inPath = path.join(tmpdir(), `${id}-in.webm`);
  const outPath = path.join(tmpdir(), `${id}-out.ogg`);
  await writeFile(inPath, buffer);
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inPath,
      "-vn",
      "-map_metadata",
      "-1",
      "-c:a",
      "libopus",
      "-b:a",
      "32k",
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await unlink(inPath).catch(() => {});
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

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      message_type: "text",
      body,
      wa_message_id: result.messages[0]?.id,
      status: "sent",
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    revalidatePath(`/dashboard/inbox/${conversationId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true as const, conversationId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function sendChatMedia(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const conversationId = String(formData.get("conversationId") ?? "");
  const file = formData.get("file") as File | null;
  if (!conversationId || !file || file.size === 0) {
    return { error: "Adjunta un archivo." };
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, workspace_id, contacts(wa_id)")
    .eq("id", conversationId)
    .single();

  if (!conversation) return { error: "Conversación no encontrada." };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", conversation.workspace_id)
    .single();

  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  const contactWaId = (conversation.contacts as unknown as { wa_id: string }).wa_id;
  const mediaType = mediaTypeFromMime(file.type);

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

  const { error: uploadError } = await admin.storage
    .from("chat-media")
    .upload(storagePath, uploadBuffer, { contentType: uploadContentType });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(storagePath);

  try {
    const result = await sendMediaMessage(
      account.phone_number_id,
      account.access_token,
      contactWaId,
      mediaType,
      publicUrl,
      uploadFilename
    );

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      message_type: mediaType,
      body: mediaType === "document" ? uploadFilename : null,
      media_url: publicUrl,
      media_mime_type: uploadContentType,
      wa_message_id: result.messages[0]?.id,
      status: "sent",
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    revalidatePath(`/dashboard/inbox/${conversationId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function sendMessage(input: { conversationId: string; body: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, workspace_id, contacts(wa_id)")
    .eq("id", input.conversationId)
    .single();

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
