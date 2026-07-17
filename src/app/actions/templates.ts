"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createMetaTemplate, listTemplates } from "@/lib/whatsapp/graph";
import { getWorkspaceId } from "@/lib/workspace";

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
  const headerText = String(formData.get("headerText") ?? "").trim();
  const bodyText = String(formData.get("bodyText") ?? "").trim();
  const footerText = String(formData.get("footerText") ?? "").trim();

  if (!/^[a-z0-9_]+$/.test(name)) {
    return { error: "El nombre solo puede tener minúsculas, números y guiones bajos (_)." };
  }
  if (!bodyText) return { error: "El cuerpo del mensaje es obligatorio." };

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
    const result = await createMetaTemplate(account.waba_id, account.access_token, {
      name,
      language,
      category,
      headerText: headerText || undefined,
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
