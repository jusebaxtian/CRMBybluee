import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { validateMediaMime, validateMediaSize } from "@/lib/whatsapp/media-limits";
import { transcodeVideoToH264 } from "@/lib/whatsapp/video-transcode";

// Plain REST endpoint (not a Server Action) so the client can upload via
// XMLHttpRequest and get real upload progress — fetch/Server Actions don't
// expose progress events, XHR's upload.onprogress does. Mirrors
// setTemplateHeaderMedia() in src/app/actions/templates.ts.
//
// Always returns JSON, even on an unexpected failure — a raw phone video
// used to be validated against WhatsApp's 16MB cap BEFORE any compression,
// so anything over that (the vast majority of phone videos, easily
// 80-200MB) failed partway through the raw upload once it hit nginx's/
// Next's body-size cap, and the client saw a truncated non-JSON error page
// which surfaced as "respuesta inválida del servidor" around whatever %
// had made it through. Now the video gets transcoded down to WhatsApp's
// limit here, same as automation/followup media uploads already do.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const workspaceId = await getWorkspaceId(supabase);
    if (!workspaceId) {
      return NextResponse.json({ error: "No se encontró tu workspace." }, { status: 401 });
    }

    const formData = await request.formData();
    const templateId = String(formData.get("templateId") ?? "");
    const file = formData.get("file") as File | null;
    if (!templateId) {
      return NextResponse.json({ error: "Plantilla no especificada." }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Sube un archivo." }, { status: 400 });
    }

    const { data: template } = await supabase
      .from("templates")
      .select("header_format")
      .eq("id", templateId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!template) {
      return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
    }
    const headerFormat = template.header_format as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    if (!headerFormat || headerFormat === "TEXT") {
      return NextResponse.json(
        { error: "Esta plantilla no tiene un encabezado de archivo." },
        { status: 400 }
      );
    }

    const kind = headerFormat.toLowerCase() as "image" | "video" | "document";
    const admin = createAdminClient();

    let uploadBody: Buffer | File = file;
    let contentType = file.type;
    let storedFilename = file.name;

    if (kind === "video") {
      const mimeError = validateMediaMime("video", file.type);
      if (mimeError) return NextResponse.json({ error: mimeError }, { status: 400 });

      let transcoded: Buffer;
      try {
        const ext = file.name.split(".").pop() || "mp4";
        transcoded = await transcodeVideoToH264(Buffer.from(await file.arrayBuffer()), ext);
      } catch {
        return NextResponse.json(
          { error: "No se pudo procesar el video. Intenta con otro archivo." },
          { status: 500 }
        );
      }

      const sizeError = validateMediaSize("video", transcoded.length);
      if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 });

      uploadBody = transcoded;
      contentType = "video/mp4";
      storedFilename = file.name.replace(/\.[^.]+$/, "") + ".mp4";
    } else {
      const validationError = validateMediaMime(kind, file.type) ?? validateMediaSize(kind, file.size);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const path = `${workspaceId}/templates/${Date.now()}-${storedFilename}`;
    const { error: uploadError } = await admin.storage
      .from("chat-media")
      .upload(path, uploadBody, { contentType });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("chat-media").getPublicUrl(path);

    const { error } = await supabase
      .from("templates")
      .update({ header_media_url: publicUrl, header_media_mime_type: contentType })
      .eq("id", templateId)
      .eq("workspace_id", workspaceId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/dashboard/templates");
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido al subir el archivo." },
      { status: 500 }
    );
  }
}
