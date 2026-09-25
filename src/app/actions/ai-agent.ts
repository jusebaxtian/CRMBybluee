"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { buildSystemPrompt, interpretAiReply, customerRequestedHuman } from "@/lib/ai/agent";
import { mediaKindFromMime, validateMediaFile } from "@/lib/whatsapp/media-limits";
import { toPublicUrl } from "@/lib/supabase/config";
import { requireWorkspace } from "@/lib/auth/with-workspace";

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
  const followupEnabled = formData.get("followupEnabled") === "on";
  const followupTemplateId = String(formData.get("followupTemplateId") ?? "").trim() || null;

  let followupSteps: { delay_minutes: number; focus: string }[] = [];
  const followupStepsRaw = String(formData.get("followupSteps") ?? "[]");
  try {
    const parsed = JSON.parse(followupStepsRaw);
    if (Array.isArray(parsed)) {
      followupSteps = parsed
        .map((s) => ({
          delay_minutes: Math.max(1, Math.round(Number(s.delay_minutes))),
          focus: String(s.focus ?? "").trim(),
        }))
        .filter((s) => Number.isFinite(s.delay_minutes) && s.focus.length > 0)
        .sort((a, b) => a.delay_minutes - b.delay_minutes);
    }
  } catch {
    followupSteps = [];
  }

  // Linea a la que atiende este agente (migracion 0118). Vacio = atiende
  // las lineas que no tengan agente propio.
  const whatsappAccountId = String(formData.get("whatsappAccountId") ?? "") || null;

  if (provider !== "openai" && provider !== "anthropic") {
    return { error: "Selecciona un proveedor válido." };
  }
  if (followupEnabled && followupSteps.length === 0) {
    return { error: "Agrega al menos un paso de seguimiento (tiempo de espera + enfoque)." };
  }
  if (followupEnabled && !followupTemplateId) {
    return {
      error:
        "Elige una plantilla de seguimiento — se usa cuando pasan más de 24h sin respuesta y WhatsApp exige una plantilla aprobada.",
    };
  }

  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  // Editing an already-connected agent doesn't require re-pasting the key —
  // the field starts empty (we never send the stored key back to the
  // browser), so a blank submit here means "keep the current one." Only
  // re-validate against the provider when the key actually changed.
  let apiKey = submittedApiKey;
  let keyChanged = true;
  if (!submittedApiKey) {
    // La llave es del espacio: se comparte entre todos los agentes. Si este
    // agente aun no existe, se hereda la del espacio en vez de pedirla otra vez.
    const { data: agentesDelEspacio } = await supabase
      .from("ai_agents")
      .select("api_key, provider, whatsapp_account_id")
      .eq("workspace_id", workspaceId);
    const propio = (agentesDelEspacio ?? []).find(
      (a) => (a.whatsapp_account_id ?? null) === whatsappAccountId
    );
    const cualquiera = propio ?? (agentesDelEspacio ?? []).find((a) => a.provider === provider) ?? (agentesDelEspacio ?? [])[0];
    if (!cualquiera) return { error: "Pega tu API key." };
    apiKey = cualquiera.api_key;
    keyChanged = cualquiera.provider !== provider;
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

  // Un agente por linea: se actualiza el de esa linea o se crea si no existe.
  const consultaId = supabase.from("ai_agents").select("id").eq("workspace_id", workspaceId);
  const { data: filaExistente } = await (whatsappAccountId
    ? consultaId.eq("whatsapp_account_id", whatsappAccountId)
    : consultaId.is("whatsapp_account_id", null)
  ).maybeSingle();

  const datos = {
    workspace_id: workspaceId,
    whatsapp_account_id: whatsappAccountId,
    provider,
    api_key: apiKey,
    model,
    agent_name: agentName,
    persona,
    followup_enabled: followupEnabled,
    followup_steps: followupSteps,
    followup_template_id: followupTemplateId,
    updated_at: new Date().toISOString(),
  };
  const { error } = filaExistente
    ? await supabase.from("ai_agents").update(datos).eq("id", filaExistente.id)
    : await supabase.from("ai_agents").insert(datos);
  if (error) return { error: error.message };

  // Una sola llave por espacio: si la cambiaron aqui, se actualiza en todos
  // los agentes del espacio para que no queden claves distintas por linea.
  if (submittedApiKey) {
    await supabase
      .from("ai_agents")
      .update({ api_key: apiKey, provider })
      .eq("workspace_id", workspaceId)
      .neq("api_key", apiKey);
  }

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
  message: string,
  whatsappAccountId?: string | null
) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const consultaAgente = supabase
    .from("ai_agents")
    .select("provider, api_key, model, agent_name, persona")
    .eq("workspace_id", workspaceId);
  const { data: agent } = await (whatsappAccountId
    ? consultaAgente.eq("whatsapp_account_id", whatsappAccountId)
    : consultaAgente.is("whatsapp_account_id", null)
  ).maybeSingle();
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

// La IA y las automatizaciones de palabra clave/etiqueta reaccionan al mismo
// mensaje entrante, asi que solo una responde a la vez: al encender la IA se
// pausan las automatizaciones (marcadas disabled_by_ai) y al apagarla vuelven.
//
// IMPORTANTE: esto va POR LINEA (migracion 0118). Encender el agente de
// Soporte no puede tocar las automatizaciones de Ventas — paso el 25 sep 2026
// y dejo un espacio sin respuestas automaticas toda la noche.
export async function toggleAiAgentActive(isActive: boolean, whatsappAccountId?: string | null) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  // Solo las automatizaciones del mismo alcance que el agente: las de esa
  // linea, o las "de todas las lineas" cuando el agente es el general.
  const delMismoAlcance = <T extends { eq: (c: string, v: unknown) => T; is: (c: string, v: null) => T }>(q: T) =>
    whatsappAccountId ? q.eq("whatsapp_account_id", whatsappAccountId) : q.is("whatsapp_account_id", null);

  if (isActive) {
    const { error: pauseError } = await delMismoAlcance(
      supabase
        .from("automations")
        .update({ is_active: false, disabled_by_ai: true })
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .in("trigger_type", ["keyword", "tag_added"])
    );
    if (pauseError) return { error: pauseError.message };
  }

  const consulta = supabase.from("ai_agents").update({ is_active: isActive }).eq("workspace_id", workspaceId);
  const { error } = await (whatsappAccountId
    ? consulta.eq("whatsapp_account_id", whatsappAccountId)
    : consulta.is("whatsapp_account_id", null));
  if (error) return { error: error.message };

  if (!isActive) {
    const { error: restoreError } = await delMismoAlcance(
      supabase
        .from("automations")
        .update({ is_active: true, disabled_by_ai: false })
        .eq("workspace_id", workspaceId)
        .eq("disabled_by_ai", true)
    );
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

  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const admin = createAdminClient();
  const path = `${workspaceId}/ai-agent-media/${Date.now()}-${file.name}`;
  const { error: uploadError } = await admin.storage
    .from("chat-media")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl: rawPublicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);
  const publicUrl = toPublicUrl(rawPublicUrl);

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

  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

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
      data: { publicUrl: rawPublicUrl2 },
    } = admin.storage.from("chat-media").getPublicUrl(path);
    const publicUrl = toPublicUrl(rawPublicUrl2);

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
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  await supabase.from("ai_agent_media").delete().eq("id", id).eq("workspace_id", workspaceId);
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function setAiManuallyPaused(conversationId: string, paused: boolean) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

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
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { error } = await supabase
    .from("conversations")
    .update({ ai_handoff_requested: false, ai_manually_paused: false })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { success: true as const };
}
