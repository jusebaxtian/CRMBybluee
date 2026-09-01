import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createMetaTemplate,
  uploadTemplateHeaderExample,
  type TemplateButtonInput,
} from "@/lib/whatsapp/graph";
import { getWorkspaceId } from "@/lib/workspace";
import { validateMediaFile, validateMediaMime, validateMediaSize } from "@/lib/whatsapp/media-limits";
import { transcodeVideoToH264 } from "@/lib/whatsapp/video-transcode";

// Plain REST endpoint (not a Server Action) so the client can submit via
// XMLHttpRequest and get real upload progress for the header file — fetch/
// Server Actions don't expose progress events, XHR's upload.onprogress does.
// Mirrors createTemplate() in src/app/actions/templates.ts exactly.
//
// Always returns JSON, even on an unexpected failure — see the comment in
// /api/template-header-media/route.ts for why a raw un-transcoded video
// used to blow past nginx's/Next's body-size cap and surface as a cryptic
// "respuesta inválida del servidor" partway through the upload.
export async function POST(request: NextRequest) {
  try {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim().toLowerCase();
  const language = String(formData.get("language") ?? "es");
  const category = String(formData.get("category") ?? "UTILITY") as
    | "MARKETING"
    | "UTILITY"
    | "AUTHENTICATION";
  const headerKind = String(formData.get("headerKind") ?? "none") as
    | "none"
    | "text"
    | "image"
    | "video"
    | "document";
  const headerText = String(formData.get("headerText") ?? "").trim();
  const headerFile = formData.get("headerFile") as File | null;
  const bodyText = String(formData.get("bodyText") ?? "").trim();
  const footerText = String(formData.get("footerText") ?? "").trim();
  const buttonsJson = String(formData.get("buttonsJson") ?? "[]");

  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json(
      { error: "El nombre solo puede tener minúsculas, números y guiones bajos (_)." },
      { status: 400 }
    );
  }
  if (!bodyText) {
    return NextResponse.json({ error: "El cuerpo del mensaje es obligatorio." }, { status: 400 });
  }
  if (headerKind === "text" && !headerText) {
    return NextResponse.json({ error: "Escribe el texto del encabezado." }, { status: 400 });
  }
  if (["image", "video", "document"].includes(headerKind) && (!headerFile || headerFile.size === 0)) {
    return NextResponse.json(
      { error: "Sube el archivo de ejemplo para el encabezado." },
      { status: 400 }
    );
  }

  let rawButtons: { type: "URL" | "QUICK_REPLY"; text: string; url: string }[];
  try {
    rawButtons = JSON.parse(buttonsJson);
  } catch {
    return NextResponse.json({ error: "Botones inválidos." }, { status: 400 });
  }
  const buttons: TemplateButtonInput[] = rawButtons
    .filter((b) => b.text.trim())
    .map((b) =>
      b.type === "URL"
        ? { type: "URL" as const, text: b.text.trim(), url: b.url.trim() }
        : { type: "QUICK_REPLY" as const, text: b.text.trim() }
    );
  for (const b of buttons) {
    if (b.type === "URL" && !b.url) {
      return NextResponse.json({ error: `Escribe la URL del botón "${b.text}".` }, { status: 400 });
    }
    if (b.type === "URL" && !/^https?:\/\//i.test(b.url)) {
      return NextResponse.json(
        { error: `La URL del botón "${b.text}" debe empezar con https:// o http://.` },
        { status: 400 }
      );
    }
  }
  buttons.sort((a, b) => (a.type === b.type ? 0 : a.type === "QUICK_REPLY" ? -1 : 1));

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) {
    return NextResponse.json({ error: "No se encontró tu workspace." }, { status: 401 });
  }

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("waba_id, access_token")
    .eq("workspace_id", workspaceId)
    .neq("status", "frozen")
    .limit(1)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "Este workspace no tiene WhatsApp conectado." }, { status: 400 });
  }

  let headerMedia: { format: "IMAGE" | "VIDEO" | "DOCUMENT"; handle: string } | undefined;
  let headerMediaUrl: string | null = null;
  let headerMediaMimeType: string | null = null;

  if (["image", "video", "document"].includes(headerKind) && headerFile) {
    let uploadBody: Buffer | File = headerFile;
    let contentType = headerFile.type;
    let storedFilename = headerFile.name;

    if (headerKind === "video") {
      const mimeError = validateMediaMime("video", headerFile.type);
      if (mimeError) return NextResponse.json({ error: mimeError }, { status: 400 });

      let transcoded: Buffer;
      try {
        const ext = headerFile.name.split(".").pop() || "mp4";
        transcoded = await transcodeVideoToH264(Buffer.from(await headerFile.arrayBuffer()), ext);
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
      storedFilename = headerFile.name.replace(/\.[^.]+$/, "") + ".mp4";
    } else {
      const validationError = validateMediaFile(headerKind as "image" | "document", headerFile);
      if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const buffer = Buffer.isBuffer(uploadBody) ? uploadBody : Buffer.from(await uploadBody.arrayBuffer());
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) {
      return NextResponse.json(
        { error: "Falta configurar NEXT_PUBLIC_META_APP_ID en el servidor." },
        { status: 500 }
      );
    }

    try {
      const handle = await uploadTemplateHeaderExample(
        appId,
        account.access_token,
        buffer,
        contentType,
        storedFilename
      );
      headerMedia = { format: headerKind.toUpperCase() as "IMAGE" | "VIDEO" | "DOCUMENT", handle };
    } catch (err) {
      return NextResponse.json(
        {
          error: `No se pudo subir el archivo de ejemplo a Meta: ${err instanceof Error ? err.message : "error desconocido"}`,
        },
        { status: 500 }
      );
    }

    const admin = createAdminClient();
    const path = `${workspaceId}/templates/${Date.now()}-${storedFilename}`;
    const { error: uploadError } = await admin.storage
      .from("chat-media")
      .upload(path, buffer, { contentType });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("chat-media").getPublicUrl(path);
    headerMediaUrl = publicUrl;
    headerMediaMimeType = contentType;
  }

  try {
    const result = await createMetaTemplate(account.waba_id, account.access_token, {
      name,
      language,
      category,
      headerText: headerKind === "text" ? headerText : undefined,
      headerMedia,
      bodyText,
      footerText: footerText || undefined,
      buttons: buttons.length > 0 ? buttons : undefined,
    });

    const variableCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;

    await supabase.from("templates").upsert(
      {
        workspace_id: workspaceId,
        meta_template_name: name,
        language,
        category,
        status: result.status,
        body_text: bodyText,
        buttons: buttons.length > 0 ? buttons : null,
        variable_count: variableCount,
        header_format: headerKind === "none" ? null : (headerKind.toUpperCase() as string),
        header_text: headerKind === "text" ? headerText : null,
        header_media_url: headerMediaUrl,
        header_media_mime_type: headerMediaMimeType,
        synced_at: new Date().toISOString(),
        created_via: "crm",
      },
      { onConflict: "workspace_id,meta_template_name,language" }
    );

    revalidatePath("/dashboard/templates");
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido." },
      { status: 500 }
    );
  }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido al enviar la plantilla." },
      { status: 500 }
    );
  }
}
