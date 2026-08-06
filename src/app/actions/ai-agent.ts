"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { callAiProvider } from "@/lib/ai/providers";
import { mediaKindFromMime, validateMediaFile } from "@/lib/whatsapp/media-limits";

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

const keySlugPattern = /^[a-z0-9_-]+$/;

export async function addAiAgentMedia(_prevState: unknown, formData: FormData) {
  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const label = String(formData.get("label") ?? "").trim();
  const triggerDescription = String(formData.get("triggerDescription") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!key || !keySlugPattern.test(key)) {
    return { error: "La clave solo puede tener letras minúsculas, números, - y _ (ej: qr_pago)." };
  }
  if (!label) return { error: "Ponle un nombre." };
  if (!triggerDescription) {
    return { error: "Describe cuándo debe usarlo el agente (ej: \"pregunten cómo pagar\")." };
  }
  if (!file || file.size === 0) return { error: "Selecciona un archivo." };

  const kind = mediaKindFromMime(file.type);
  if (kind === "audio") return { error: "El agente solo puede enviar imágenes, videos o documentos." };
  const validationError = validateMediaFile(kind, file);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const admin = createAdminClient();
  const path = `${workspaceId}/ai-agent-media/${Date.now()}-${file.name}`;
  const { error: uploadError } = await admin.storage
    .from("chat-media")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);

  const { error } = await supabase.from("ai_agent_media").insert({
    workspace_id: workspaceId,
    key,
    label,
    trigger_description: triggerDescription,
    media_type: kind,
    media_url: publicUrl,
    media_mime_type: file.type,
    filename: kind === "document" ? file.name : null,
  });
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? `Ya existe un medio con la clave "${key}" — usa otra.`
        : error.message,
    };
  }

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function deleteAiAgentMedia(id: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  await supabase.from("ai_agent_media").delete().eq("id", id).eq("workspace_id", workspaceId);
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function setAiManuallyPaused(conversationId: string, paused: boolean) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("conversations")
    .update({ ai_manually_paused: paused })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { success: true as const };
}

// Clears both the automatic handoff flag (AI asked for help) and the manual
// pause flag (agent chose to take over) — one button reactivates the AI on
// this chat regardless of which reason paused it.
export async function clearAiHandoff(conversationId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("conversations")
    .update({ ai_handoff_requested: false, ai_manually_paused: false })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { success: true as const };
}
