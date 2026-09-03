"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { runActionsForAutomation } from "@/lib/automations/engine";

type ActionInput = {
  action_type:
    | "send_message"
    | "add_tag"
    | "send_image"
    | "send_video"
    | "send_audio"
    | "send_document"
    | "send_template"
    | "send_quick_reply"
    | "assign_agent"
    | "assign_agent_random"
    | "wait_for_reply";
  message_body?: string;
  tag_id?: string;
  media_url?: string;
  media_filename?: string;
  template_id?: string;
  quick_reply_id?: string;
  target_agent_id?: string;
  agent_distribution?: { agent_id: string; percent: number }[];
  delay_seconds?: number;
  buttons?: ({ type: "QUICK_REPLY"; id: string; title: string } | { type: "URL"; title: string; url: string })[];
};

const mediaTypes = new Set(["send_image", "send_video", "send_audio", "send_document"]);
// Audio messages don't support a caption in the Cloud API, but image/video/document do.
const captionableTypes = new Set(["send_message", "send_image", "send_video", "send_document"]);

function actionRow(a: ActionInput, automationId: string, index: number) {
  return {
    automation_id: automationId,
    position: index,
    action_type: a.action_type,
    message_body: captionableTypes.has(a.action_type) ? a.message_body || null : null,
    tag_id: a.action_type === "add_tag" ? a.tag_id : null,
    media_url: mediaTypes.has(a.action_type) ? a.media_url : null,
    media_filename: a.action_type === "send_document" ? a.media_filename : null,
    template_id: a.action_type === "send_template" ? a.template_id : null,
    quick_reply_id: a.action_type === "send_quick_reply" ? a.quick_reply_id : null,
    target_agent_id: a.action_type === "assign_agent" ? a.target_agent_id : null,
    agent_distribution:
      a.action_type === "assign_agent_random"
        ? (a.agent_distribution ?? []).filter((d) => d.agent_id && d.percent > 0)
        : null,
    // 30 days — generous ceiling for a "días" delay step, still bounded so a
    // typo can't schedule something absurdly far out.
    delay_seconds: Math.max(0, Math.min(30 * 86400, Math.floor(a.delay_seconds ?? 0))),
    buttons: a.action_type === "send_message" && a.buttons?.length ? a.buttons : null,
  };
}

export async function uploadAutomationActionMedia(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Selecciona un archivo." };

  const admin = createAdminClient();
  const path = `${workspaceId}/automations/${Date.now()}-${file.name}`;

  const { error } = await admin.storage
    .from("chat-media")
    .upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("chat-media").getPublicUrl(path);

  return { success: true as const, url: publicUrl, filename: file.name };
}

export async function createAutomation(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const triggerType = String(formData.get("triggerType") ?? "") as
    | "tag_added"
    | "keyword"
    | "button_tap"
    | "any_message"
    | "first_message_of_day";
  const triggerTagId = String(formData.get("triggerTagId") ?? "") || null;
  const triggerKeyword = String(formData.get("triggerKeyword") ?? "").trim() || null;
  const actionsJson = String(formData.get("actionsJson") ?? "[]");

  if (!name) return { error: "El nombre es obligatorio." };
  if (triggerType === "tag_added" && !triggerTagId) {
    return { error: "Selecciona la etiqueta que activa la automatización." };
  }
  if (triggerType === "keyword" && !triggerKeyword) {
    return { error: "Escribe la palabra clave que activa la automatización." };
  }
  if (triggerType === "button_tap" && !triggerKeyword) {
    return { error: "Escribe el texto exacto del botón que activa la automatización." };
  }

  let actions: ActionInput[];
  try {
    actions = JSON.parse(actionsJson);
  } catch {
    return { error: "Acciones inválidas." };
  }
  if (actions.length === 0) return { error: "Agrega al menos una acción." };
  for (const a of actions) {
    if (mediaTypes.has(a.action_type) && !a.media_url) {
      return { error: "Sube un archivo para cada acción de imagen/video/audio/documento." };
    }
    if (a.action_type === "send_template" && !a.template_id) {
      return { error: "Selecciona una plantilla para cada acción de plantilla." };
    }
    if (a.action_type === "send_quick_reply" && !a.quick_reply_id) {
      return { error: "Selecciona una respuesta rápida para cada acción de ese tipo." };
    }
    if (a.action_type === "assign_agent" && !a.target_agent_id) {
      return { error: "Selecciona el agente para cada acción de asignación." };
    }
    if (a.action_type === "assign_agent_random") {
      const rows = (a.agent_distribution ?? []).filter((d) => d.agent_id && d.percent > 0);
      if (rows.length < 2) {
        return { error: "El aleatorizador necesita al menos 2 agentes con un porcentaje mayor a 0." };
      }
    }
  }

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  // The AI agent and keyword/tag automations are mutually exclusive (see
  // toggleAiAgentActive) — a new one created while the AI is on starts
  // paused instead of silently going live alongside it.
  const { data: aiAgent } = await supabase
    .from("ai_agents")
    .select("is_active")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const { data: automation, error } = await supabase
    .from("automations")
    .insert({
      workspace_id: workspaceId,
      name,
      trigger_type: triggerType,
      trigger_tag_id: triggerType === "tag_added" ? triggerTagId : null,
      trigger_keyword: triggerType === "keyword" || triggerType === "button_tap" ? triggerKeyword : null,
      is_active: !aiAgent?.is_active,
    })
    .select("id")
    .single();

  if (error || !automation) return { error: error?.message ?? "No se pudo crear." };

  const { error: actionsError } = await supabase
    .from("automation_actions")
    .insert(actions.map((a, index) => actionRow(a, automation.id, index)));
  if (actionsError) {
    // The automation record above already saved — leaving it with zero
    // actions (silently, as this used to) is worse than deleting it and
    // surfacing the failure so the user can retry.
    await supabase.from("automations").delete().eq("id", automation.id);
    return { error: actionsError.message };
  }

  revalidatePath("/dashboard/automations");
  redirect("/dashboard/automations");
}

export async function updateAutomation(_prevState: unknown, formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const triggerType = String(formData.get("triggerType") ?? "") as
    | "tag_added"
    | "keyword"
    | "button_tap"
    | "any_message"
    | "first_message_of_day";
  const triggerTagId = String(formData.get("triggerTagId") ?? "") || null;
  const triggerKeyword = String(formData.get("triggerKeyword") ?? "").trim() || null;
  const actionsJson = String(formData.get("actionsJson") ?? "[]");

  if (!automationId) return { error: "Automatización inválida." };
  if (!name) return { error: "El nombre es obligatorio." };
  if (triggerType === "tag_added" && !triggerTagId) {
    return { error: "Selecciona la etiqueta que activa la automatización." };
  }
  if (triggerType === "keyword" && !triggerKeyword) {
    return { error: "Escribe la palabra clave que activa la automatización." };
  }
  if (triggerType === "button_tap" && !triggerKeyword) {
    return { error: "Escribe el texto exacto del botón que activa la automatización." };
  }

  let actions: ActionInput[];
  try {
    actions = JSON.parse(actionsJson);
  } catch {
    return { error: "Acciones inválidas." };
  }
  if (actions.length === 0) return { error: "Agrega al menos una acción." };
  for (const a of actions) {
    if (mediaTypes.has(a.action_type) && !a.media_url) {
      return { error: "Sube un archivo para cada acción de imagen/video/audio/documento." };
    }
    if (a.action_type === "send_template" && !a.template_id) {
      return { error: "Selecciona una plantilla para cada acción de plantilla." };
    }
    if (a.action_type === "send_quick_reply" && !a.quick_reply_id) {
      return { error: "Selecciona una respuesta rápida para cada acción de ese tipo." };
    }
    if (a.action_type === "assign_agent" && !a.target_agent_id) {
      return { error: "Selecciona el agente para cada acción de asignación." };
    }
    if (a.action_type === "assign_agent_random") {
      const rows = (a.agent_distribution ?? []).filter((d) => d.agent_id && d.percent > 0);
      if (rows.length < 2) {
        return { error: "El aleatorizador necesita al menos 2 agentes con un porcentaje mayor a 0." };
      }
    }
  }

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("automations")
    .update({
      name,
      trigger_type: triggerType,
      trigger_tag_id: triggerType === "tag_added" ? triggerTagId : null,
      trigger_keyword: triggerType === "keyword" || triggerType === "button_tap" ? triggerKeyword : null,
    })
    .eq("id", automationId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  await supabase.from("automation_actions").delete().eq("automation_id", automationId);
  const { error: actionsError } = await supabase
    .from("automation_actions")
    .insert(actions.map((a, index) => actionRow(a, automationId, index)));
  if (actionsError) return { error: actionsError.message };

  revalidatePath("/dashboard/automations");
  redirect("/dashboard/automations");
}

export async function toggleAutomationActive(automationId: string, isActive: boolean) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  // The AI agent and keyword/tag automations are mutually exclusive (see
  // toggleAiAgentActive) — while the AI is on, automations stay paused and
  // can't be turned back on manually until the AI is turned off.
  if (isActive) {
    const { data: agent } = await supabase
      .from("ai_agents")
      .select("is_active")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (agent?.is_active) {
      return {
        error: "El agente de IA está activo — apágalo primero para poder activar automatizaciones.",
      };
    }
  }

  const { error } = await supabase
    .from("automations")
    .update({ is_active: isActive, disabled_by_ai: false })
    .eq("id", automationId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/automations");
  return { success: true as const };
}

export async function deleteAutomation(automationId: string) {
  const supabase = await createClient();
  await supabase.from("automations").delete().eq("id", automationId);
  revalidatePath("/dashboard/automations");
}

// Triggered by a single click from the chat's floating menu — same
// executor keyword/tag automations use, just started manually instead of
// by an event. Both automation and contact are re-checked against the
// caller's workspace so an id from another tenant can't be run here.
export async function runAutomationManually(automationId: string, contactId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: automation } = await supabase
    .from("automations")
    .select("id, workspace_id")
    .eq("id", automationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!automation) return { error: "Automatización no encontrada." };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contact) return { error: "Contacto no encontrado." };

  try {
    await runActionsForAutomation(supabase, automation, contactId);
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo ejecutar la automatización." };
  }
}
