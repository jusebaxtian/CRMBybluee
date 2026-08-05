"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { callAiProvider } from "@/lib/ai/providers";

const defaultModel: Record<"openai" | "anthropic", string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
};

export async function saveAiAgent(_prevState: unknown, formData: FormData) {
  const provider = String(formData.get("provider") ?? "") as "openai" | "anthropic";
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim() || defaultModel[provider];
  const agentName = String(formData.get("agentName") ?? "").trim() || "Asistente";
  const persona = String(formData.get("persona") ?? "").trim();

  if (provider !== "openai" && provider !== "anthropic") {
    return { error: "Selecciona un proveedor válido." };
  }
  if (!apiKey) return { error: "Pega tu API key." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  // Quick real call to catch a bad/expired key before saving it, instead of
  // finding out only when a real customer message doesn't get a reply.
  try {
    await callAiProvider(provider, apiKey, model, "Responde solo con la palabra: ok", [
      { role: "user", content: "test" },
    ]);
  } catch (err) {
    return {
      error: `No se pudo validar la API key: ${err instanceof Error ? err.message : "error desconocido"}`,
    };
  }

  const { error } = await supabase.from("ai_agents").upsert({
    workspace_id: workspaceId,
    provider,
    api_key: apiKey,
    model,
    agent_name: agentName,
    persona,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function toggleAiAgentActive(isActive: boolean) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("ai_agents")
    .update({ is_active: isActive })
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function clearAiHandoff(conversationId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("conversations")
    .update({ ai_handoff_requested: false })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { success: true as const };
}
