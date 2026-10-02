"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteMetaTemplate, listTemplates } from "@/lib/whatsapp/graph";
import { validateMediaFile } from "@/lib/whatsapp/media-limits";
import { toPublicUrl } from "@/lib/supabase/config";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { wabasDelEspacio } from "@/lib/whatsapp/wabas";
import { cuantasVariables, type VariableDePlantilla } from "@/lib/contactos/variables";

export async function syncTemplates() {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  // Una pasada por cada WABA del espacio: las plantillas viven en la WABA
  // (migracion 0106), asi que un espacio con lineas de WABAs distintas
  // tiene conjuntos distintos.
  const wabas = await wabasDelEspacio(supabase, workspaceId);
  if (wabas.length === 0) return { error: "Este workspace no tiene WhatsApp conectado." };

  try {
    let total = 0;
    for (const waba of wabas) {
      const metaTemplates = await listTemplates(waba.wabaId, waba.accessToken);
      total += metaTemplates.length;

      for (const t of metaTemplates) {
        const bodyComponent = t.components.find((c) => c.type === "BODY");
        const bodyText = bodyComponent?.text ?? "";
        const variableCount = cuantasVariables(bodyText);

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
            waba_id: waba.wabaId,
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
          { onConflict: "workspace_id,waba_id,meta_template_name,language" }
        );
      }

      // Templates removed directly in Meta (or deleted here but orphaned by a
      // failed follow-up) never disappear on their own — prune anything local
      // that Meta no longer reports for this WABA.
      const metaNames = new Set(metaTemplates.map((t) => `${t.name}::${t.language}`));
      const { data: localTemplates } = await supabase
        .from("templates")
        .select("id, meta_template_name, language")
        .eq("workspace_id", workspaceId)
        .eq("waba_id", waba.wabaId);

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
    }

    revalidatePath("/dashboard/templates");
    return { success: true, count: total };
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
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

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
    data: { publicUrl: rawPublicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);
  const publicUrl = toPublicUrl(rawPublicUrl);

  const { error } = await supabase
    .from("templates")
    .update({ header_media_url: publicUrl, header_media_mime_type: file.type })
    .eq("id", templateId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { success: true as const };
}

/**
 * Con qué se rellena cada variable de una plantilla que YA existe en Meta.
 *
 * El texto de una plantilla aprobada no se puede tocar, pero el
 * emparejamiento es dato nuestro: se puede arreglar sin recrearla ni volver a
 * pasar por aprobación. Hace falta porque todas las plantillas creadas antes
 * del 1 oct 2026 --y las que creó la ruta mientras ignoraba el
 * emparejamiento-- se guardaron sin él, y al enviarlas Meta las rechaza con
 * el 132000.
 */
export async function guardarEmparejamiento(templateId: string, variables: VariableDePlantilla[]) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: template } = await supabase
    .from("templates")
    .select("body_text")
    .eq("id", templateId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!template) return { error: "Plantilla no encontrada." };

  // El número de variables lo manda el cuerpo aprobado, no el formulario: así
  // un emparejamiento corto o largo no deja la plantilla peor de como estaba.
  const cuantas = cuantasVariables(template.body_text ?? "");
  if (cuantas === 0) return { error: "Esta plantilla no tiene variables que emparejar." };
  if (variables.length !== cuantas) {
    return { error: `La plantilla tiene ${cuantas} variable(s): indica con qué se rellena cada una.` };
  }

  const { error } = await supabase
    .from("templates")
    .update({ variable_count: cuantas, variables_origen: variables })
    .eq("id", templateId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/templates");
  return { success: true };
}

export async function deleteTemplate(templateId: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: template } = await supabase
    .from("templates")
    .select("meta_template_name, waba_id")
    .eq("id", templateId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!template) return { error: "Plantilla no encontrada." };

  // Se borra en la WABA a la que pertenece (migracion 0106).
  const wabas = await wabasDelEspacio(supabase, workspaceId);
  const waba = wabas.find((w) => w.wabaId === template.waba_id) ?? (wabas.length === 1 ? wabas[0] : undefined);
  if (!waba) return { error: "La línea de esta plantilla ya no está conectada." };
  const account = { waba_id: waba.wabaId, access_token: waba.accessToken };

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
