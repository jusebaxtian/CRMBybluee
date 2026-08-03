import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";

// WhatsApp Cloud API only accepts these mime types per media kind — anything
// else is silently accepted at upload time but rejected later when the
// message actually gets sent (error 131053), which is confusing because the
// failure shows up days later, disconnected from the upload. Validating here
// catches a mismatched file (e.g. a screenshot picked for a "video" action)
// immediately, with a message that names the problem.
const allowedMimesByActionType: Record<string, string[]> = {
  send_image: ["image/jpeg", "image/png"],
  send_video: ["video/mp4", "video/3gpp"],
  send_audio: ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"],
  send_document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
};

const mediaKindLabel: Record<string, string> = {
  send_image: "una imagen",
  send_video: "un video",
  send_audio: "un audio",
  send_document: "un documento",
};

const mimeLabel: Record<string, string> = {
  "image/png": "una imagen PNG",
  "image/jpeg": "una imagen JPEG",
  "video/mp4": "un video MP4",
  "video/quicktime": "un video MOV",
  "video/webm": "un video WEBM",
  "audio/wav": "un audio WAV",
};

// Plain REST endpoint (not a Server Action) so the client can upload via
// XMLHttpRequest and get real upload progress — fetch/Server Actions don't
// expose progress events, XHR's upload.onprogress does.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
    return NextResponse.json({ error: "No se encontró tu workspace." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const actionType = String(formData.get("actionType") ?? "");
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Selecciona un archivo." }, { status: 400 });
  }

  const allowedMimes = allowedMimesByActionType[actionType];
  if (allowedMimes && !allowedMimes.includes(file.type)) {
    const gotLabel = mimeLabel[file.type] ?? `un archivo "${file.type || "desconocido"}"`;
    const wantLabel = mediaKindLabel[actionType] ?? "el tipo correcto de archivo";
    return NextResponse.json(
      {
        error: `Ese archivo es ${gotLabel}, pero esta acción necesita ${wantLabel}. WhatsApp solo acepta: ${allowedMimes.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const path = `${workspaceId}/automations/${Date.now()}-${file.name}`;

  const { error } = await admin.storage
    .from("chat-media")
    .upload(path, file, { contentType: file.type });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);

  return NextResponse.json({ success: true, url: publicUrl, filename: file.name });
}
