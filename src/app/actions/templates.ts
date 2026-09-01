"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createMetaTemplate,
  deleteMetaTemplate,
  listTemplates,
  uploadTemplateHeaderExample,
  type TemplateButtonInput,
} from "@/lib/whatsapp/graph";
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
    .neq("status", "frozen")
    // Templates belong to the shared WABA, not to any one phone number, so
    // any connected account's token can manage them.
    .limit(1)
    .maybeSingle();
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  try {
    const metaTemplates = await listTemplates(account.waba_id, account.access_token);

    for (const t of metaTemplates) {
      const bodyComponent = t.components.find((c) => c.type === "BODY");
      const bodyText = bodyComponent?.text ?? "";
      const variableCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;

      // A template created directly in Meta Business Manager (not through
      // "Crear plantilla" here) used to sync in with NO header info at all —
      // only the body got copied. For a template with an IMAGE/VIDEO/
      // DOCUMENT header, that meant every send silently omitted the header
      // component entirely, and Meta rejected it ("header component
      // parameter should not be empty"). header_media_url stays null here
      // regardless — Meta's sync response only gives back an ephemeral
      // upload handle for the header example, not a URL we can reuse for
      // future sends, so a media header still needs its file uploaded once
      // through the template list (see fillTemplateHeaderMedia below).
      const headerComponent = t.components.find((c) => c.type === "HEADER");
      const headerFormat = headerComponent?.format ?? null;
      const headerText = headerFormat === "TEXT" ? headerComponent?.text ?? null : null;

      const buttonsComponent = t.components.find((c) => c.type === "BUTTONS");
      const buttons = buttonsComponent?.buttons?.map((b) => ({
        type: b.type === "URL" ? ("URL" as const) : ("QUICK_REPLY" as const),
        text: b.text,
        ...(b.type === "URL" && b.url ? { url: b.url } : {}),
      }));

      await supabase.from("templates").upsert(
        {
          workspace_id: workspaceId,
          meta_template_name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          body_text: bodyText,
          variable_count: variableCount,
          header_format: headerFormat,
          header_text: headerText,
          buttons: buttons && buttons.length > 0 ? buttons : null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,meta_template_name,language" }
      );
    }

    // Templates removed directly in Meta (or deleted here but orphaned by a
    // failed follow-up) never disappear on their own — prune anything local
    // that Meta no longer reports for this WABA.
    const metaNames = new Set(metaTemplates.map((t) => `${t.name}::${t.language}`));
    const { data: localTemplates } = await supabase
      .from("templates")
      .select("id, meta_template_name, language")
      .eq("workspace_id", workspaceId);

    const staleIds = (localTemplates ?? [])
      .filter((t) => !metaNames.has(`${t.meta_template_name}::${t.language}`))
      .map((t) => t.id);
    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase.from("templates").delete().in("id", staleIds);
      if (deleteError) {
        // Some of the stale rows are referenced by past campaigns and can't
        // be hard-deleted — mark those as removed instead so they stop
        // showing a stale APPROVED status.
        await supabase.from("templates").update({ status: "DELETED" }).in("id", staleIds);
      }
    }

    revalidatePath("/dashboard/templates");
    return { success: true, count: metaTemplates.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

// For a template synced in from Meta with an IMAGE/VIDEO/DOCUMENT header —
// syncTemplates() now detects the header exists, but Meta's API never gives
// back a reusable file for it (only an ephemeral upload handle from
// creation time), so sends fail until the actual file is provided here
// once. Same storage path/flow as create-template-form's own upload.
export async function setTemplateHeaderMedia(templateId: string, formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: template } = await supabase
    .from("templates")
    .select("header_format")
    .eq("id", templateId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!template) return { error: "Plantilla no encontrada." };
  const rawHeaderFormat = template.header_format as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  if (!rawHeaderFormat || rawHeaderFormat === "TEXT") {
    return { error: "Esta plantilla no tiene un encabezado de archivo." };
  }
  const headerFormat = rawHeaderFormat;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Sube un archivo." };

  const kind = headerFormat.toLowerCase() as "image" | "video" | "document";
  const validationError = validateMediaFile(kind, file);
  if (validationError) return { error: validationError };

  const admin = createAdminClient();
  const path = `${workspaceId}/templates/${Date.now()}-${file.name}`;
  const { error: uploadError } = await admin.storage
    .from("chat-media")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);

  const { error } = await supabase
    .from("templates")
    .update({ header_media_url: publicUrl, header_media_mime_type: file.type })
    .eq("id", templateId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { success: true as const };
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
  const buttonsJson = String(formData.get("buttonsJson") ?? "[]");

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

  let rawButtons: { type: "URL" | "QUICK_REPLY"; text: string; url: string }[];
  try {
    rawButtons = JSON.parse(buttonsJson);
  } catch {
    return { error: "Botones inválidos." };
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
      return { error: `Escribe la URL del botón "${b.text}".` };
    }
    if (b.type === "URL" && !/^https?:\/\//i.test(b.url)) {
      return { error: `La URL del botón "${b.text}" debe empezar con https:// o http://.` };
    }
  }
  // Meta allows mixing Quick Reply and URL buttons in one template, but
  // requires each type to be grouped contiguously (e.g. QR, QR, URL is fine;
  // QR, URL, QR is rejected) — reorder rather than trust the UI's order.
  buttons.sort((a, b) => (a.type === b.type ? 0 : a.type === "QUICK_REPLY" ? -1 : 1));

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("waba_id, access_token")
    .eq("workspace_id", workspaceId)
    .neq("status", "frozen")
    // Templates belong to the shared WABA, not to any one phone number, so
    // any connected account's token can manage them.
    .limit(1)
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
      },
      { onConflict: "workspace_id,meta_template_name,language" }
    );

    revalidatePath("/dashboard/templates");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: template } = await supabase
    .from("templates")
    .select("meta_template_name")
    .eq("id", templateId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!template) return { error: "Plantilla no encontrada." };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("waba_id, access_token")
    .eq("workspace_id", workspaceId)
    .neq("status", "frozen")
    // Templates belong to the shared WABA, not to any one phone number, so
    // any connected account's token can manage them.
    .limit(1)
    .maybeSingle();
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  try {
    await deleteMetaTemplate(account.waba_id, account.access_token, template.meta_template_name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo eliminar la plantilla en Meta." };
  }

  // Campaigns keep a reference to the template they were sent with, so a
  // template that was ever used in one can't be hard-deleted — fall back to
  // marking it removed so it stops showing as usable.
  const { error: deleteError } = await supabase.from("templates").delete().eq("id", templateId);
  if (deleteError) {
    await supabase.from("templates").update({ status: "DELETED" }).eq("id", templateId);
  }

  revalidatePath("/dashboard/templates");
  return { success: true };
}
