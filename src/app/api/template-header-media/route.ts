import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { validateMediaFile } from "@/lib/whatsapp/media-limits";

// Plain REST endpoint (not a Server Action) so the client can upload via
// XMLHttpRequest and get real upload progress — fetch/Server Actions don't
// expose progress events, XHR's upload.onprogress does. Mirrors
// setTemplateHeaderMedia() in src/app/actions/templates.ts.
export async function POST(request: NextRequest) {
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
  const validationError = validateMediaFile(kind, file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = `${workspaceId}/templates/${Date.now()}-${file.name}`;
  const { error: uploadError } = await admin.storage
    .from("chat-media")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);

  const { error } = await supabase
    .from("templates")
    .update({ header_media_url: publicUrl, header_media_mime_type: file.type })
    .eq("id", templateId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/dashboard/templates");
  return NextResponse.json({ success: true, url: publicUrl });
}
