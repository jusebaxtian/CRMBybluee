"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listTemplates } from "@/lib/whatsapp/graph";
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
