"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMetaTemplate, listTemplates, uploadTemplateHeaderExample } from "@/lib/whatsapp/graph";
import { getWorkspaceId } from "@/lib/workspace";
import { validateMediaFile } from "@/lib/whatsapp/media-limits";

export async function syncTemplates() {
  const supabase = await createClient();

  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("waba_id, access_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  try {
    const metaTemplates = await listTemplates(account.waba_id, account.access_token);

    for (const t of metaTemplates) {
      const bodyComponent = t.components.find((c) => c.type === "BODY");
      const bodyText = bodyComponent?.text ?? "";
      const variableCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;

      await supabase.from("templates").upsert(
        {
          workspace_id: workspaceId,
          meta_template_name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          body_text: bodyText,
          variable_count: variableCount,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,meta_template_name,language" }
      );
    }

    revalidatePath("/dashboard/templates");
    return { success: true, count: metaTemplates.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function createTemplate(_prevState: unknown, formData: FormData) {
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

  if (!/^[a-z0-9_]+$/.test(name)) {
    return { error: "El nombre solo puede tener minúsculas, números y guiones bajos (_)." };
  }
  if (!bodyText) return { error: "El cuerpo del mensaje es obligatorio." };
  if (headerKind === "text" && !headerText) {
    return { error: "Escribe el texto del encabezado." };
  }
  if (["image", "video", "document"].includes(headerKind) && (!headerFile || headerFile.size === 0)) {
    return { error: "Sube el archivo de ejemplo para el encabezado." };
  }

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("waba_id, access_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  let headerMedia: { format: "IMAGE" | "VIDEO" | "DOCUMENT"; handle: string } | undefined;
  let headerMediaUrl: string | null = null;
  let headerMediaMimeType: string | null = null;

  if (["image", "video", "document"].includes(headerKind) && headerFile) {
    const validationError = validateMediaFile(headerKind as "image" | "video" | "document", headerFile);
    if (validationError) return { error: validationError };

    const buffer = Buffer.from(await headerFile.arrayBuffer());
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    if (!appId) return { error: "Falta configurar NEXT_PUBLIC_META_APP_ID en el servidor." };

    try {
      const handle = await uploadTemplateHeaderExample(
        appId,
        account.access_token,
        buffer,
        headerFile.type,
        headerFile.name
      );
      headerMedia = { format: headerKind.toUpperCase() as "IMAGE" | "VIDEO" | "DOCUMENT", handle };
    } catch (err) {
      return {
        error: `No se pudo subir el archivo de ejemplo a Meta: ${err instanceof Error ? err.message : "error desconocido"}`,
      };
    }

    // Our own copy — this is what actually gets attached when a campaign or
    // automation sends the template later (Meta's upload handle is only
    // used once, at template-creation time, not for every send).
    const admin = createAdminClient();
    const path = `${workspaceId}/templates/${Date.now()}-${headerFile.name}`;
    const { error: uploadError } = await admin.storage
      .from("chat-media")
      .upload(path, headerFile, { contentType: headerFile.type });
    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = admin.storage.from("chat-media").getPublicUrl(path);
    headerMediaUrl = publicUrl;
    headerMediaMimeType = headerFile.type;
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
        variable_count: variableCount,
        header_format: headerKind === "none" ? null : (headerKind.toUpperCase() as string),
        header_text: headerKind === "text" ? headerText : null,
        header_media_url: headerMediaUrl,
        header_media_mime_type: headerMediaMimeType,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,meta_template_name,language" }
    );

    revalidatePath("/dashboard/templates");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}
