"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { buildSystemPrompt, interpretAiReply, customerRequestedHuman } from "@/lib/ai/agent";
import { mediaKindFromMime, validateMediaFile } from "@/lib/whatsapp/media-limits";

const defaultModel: Record<"openai" | "anthropic", string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
};

export async function saveAiAgent(_prevState: unknown, formData: FormData) {
  const provider = String(formData.get("provider") ?? "") as "openai" | "anthropic";
  const submittedApiKey = String(formData.get("apiKey") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim() || defaultModel[provider];
  const agentName = String(formData.get("agentName") ?? "").trim() || "Asistente";
  const persona = String(formData.get("persona") ?? "").trim();

  if (provider !== "openai" && provider !== "anthropic") {
    return { error: "Selecciona un proveedor válido." };
  }

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  // Editing an already-connected agent doesn't require re-pasting the key —
  // the field starts empty (we never send the stored key back to the
  // browser), so a blank submit here means "keep the current one." Only
  // re-validate against the provider when the key actually changed.
  let apiKey = submittedApiKey;
  let keyChanged = true;
  if (!submittedApiKey) {
    const { data: existing } = await supabase
      .from("ai_agents")
      .select("api_key, provider")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!existing) return { error: "Pega tu API key." };
    apiKey = existing.api_key;
    keyChanged = existing.provider !== provider;
  }

  if (keyChanged) {
    // Quick real call to catch a bad/expired key before saving it, instead
    // of finding out only when a real customer message doesn't get a reply.
    try {
      await callAiProvider(provider, apiKey, model, "Responde solo con la palabra: ok", [
        { role: "user", content: "test" },
      ]);
    } catch (err) {
      return {
        error: `No se pudo validar la API key: ${err instanceof Error ? err.message : "error desconocido"}`,
      };
    }
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

// Powers the "Probar el agente" test chat in Settings — runs the exact same
// prompt-building and reply-parsing the real WhatsApp path uses, but never
// touches WhatsApp or writes any conversation/message rows. Doesn't check
// is_active or the human-request safety net's side effects (there's no real
// conversation to flip a handoff flag on) — it does still surface handoff
// and media triggers in the response so you can see what WOULD happen.
export async function testAiAgentMessage(
  history: { role: "user" | "assistant"; content: string }[],
  message: string
) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: agent } = await supabase
    .from("ai_agents")
    .select("provider, api_key, model, agent_name, persona")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!agent) return { error: "Primero conecta y guarda tu agente." };

  const { data: mediaLibrary } = await supabase
    .from("ai_agent_media")
    .select("key, label, trigger_description, media_type, media_url, media_mime_type, filename")
    .eq("workspace_id", workspaceId);

  if (customerRequestedHuman(message)) {
    return {
      success: true as const,
      reply: "¡Claro que sí! Ya te conecto con nuestro equipo, en un momento te contactan 🙌",
      handoff: true,
      media: [] as { key: string; label: string }[],
      handoffSource: "keyword" as const,
    };
  }

  const chatHistory: ChatTurn[] = [...history, { role: "user", content: message }];

  let rawReply: string;
  try {
    rawReply = await callAiProvider(
      agent.provider,
      agent.api_key,
      agent.model,
      buildSystemPrompt(agent.agent_name, agent.persona, mediaLibrary ?? []),
      chatHistory
    );
  } catch (err) {
    return {
      error: `No se pudo consultar la IA: ${err instanceof Error ? err.message : "error desconocido"}`,
    };
  }
  if (!rawReply) return { error: "La IA no devolvió ninguna respuesta." };

  const { customerReply, handoff, mediaKeys } = interpretAiReply(rawReply);
  const mediaByKey = new Map((mediaLibrary ?? []).map((m) => [m.key, m]));
  const media = mediaKeys
    .map((key) => mediaByKey.get(key))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({ key: m.key, label: m.label }));

  return {
    success: true as const,
    reply: customerReply,
    handoff,
    media,
    handoffSource: handoff ? ("model" as const) : undefined,
  };
}

// The AI and keyword/tag automations both react to inbound messages, and
// keyword automations already win over the AI when both are on — which
// meant an active automation could silently make the AI look "broken"
// (never replying) for that keyword. To keep it simple for the business
// owner, only one system answers at a time: turning the AI on pauses every
// currently-active automation (tagged disabled_by_ai so we know which ones
// to restore), and turning it off brings back exactly those.
export async function toggleAiAgentActive(isActive: boolean) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  if (isActive) {
    const { error: pauseError } = await supabase
      .from("automations")
      .update({ is_active: false, disabled_by_ai: true })
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .in("trigger_type", ["keyword", "tag_added"]);
    if (pauseError) return { error: pauseError.message };
  }

  const { error } = await supabase
    .from("ai_agents")
    .update({ is_active: isActive })
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  if (!isActive) {
    const { error: restoreError } = await supabase
      .from("automations")
      .update({ is_active: true, disabled_by_ai: false })
      .eq("workspace_id", workspaceId)
      .eq("disabled_by_ai", true);
    if (restoreError) return { error: restoreError.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/automations");
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

export async function editAiAgentMedia(_prevState: unknown, formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const triggerDescription = String(formData.get("triggerDescription") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!id) return { error: "Medio inválido." };
  if (!label) return { error: "Ponle un nombre." };
  if (!triggerDescription) {
    return { error: "Describe cuándo debe usarlo el agente (ej: \"pregunten cómo pagar\")." };
  }

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const update: Record<string, unknown> = { label, trigger_description: triggerDescription };

  // Replacing the file is optional — leaving it empty keeps the file
  // already uploaded and only updates the name/trigger text.
  if (file && file.size > 0) {
    const kind = mediaKindFromMime(file.type);
    const validationError = validateMediaFile(kind, file);
    if (validationError) return { error: validationError };

    const admin = createAdminClient();
    const path = `${workspaceId}/ai-agent-media/${Date.now()}-${file.name}`;
    const { error: uploadError } = await admin.storage
      .from("chat-media")
      .upload(path, file, { contentType: file.type });
    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = admin.storage.from("chat-media").getPublicUrl(path);

    update.media_type = kind;
    update.media_url = publicUrl;
    update.media_mime_type = file.type;
    update.filename = kind === "document" ? file.name : null;
  }

  const { error } = await supabase
    .from("ai_agent_media")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

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
