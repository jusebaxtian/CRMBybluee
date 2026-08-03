import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { validateMediaFile, type MediaKind } from "@/lib/whatsapp/media-limits";

const mediaKindByActionType: Record<string, MediaKind> = {
  send_image: "image",
  send_video: "video",
  send_audio: "audio",
  send_document: "document",
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

  const mediaKind = mediaKindByActionType[actionType];
  if (mediaKind) {
    const validationError = validateMediaFile(mediaKind, file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
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
