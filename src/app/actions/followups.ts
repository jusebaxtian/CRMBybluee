"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

// Mirrors src/app/actions/automations.ts's create/update logic almost
// exactly — kept as a separate copy (not a shared import) so this feature's
// fixed trigger_type ("no_reply") and its own redirect target can't drift
// into automations.ts's general tag/keyword flow, and vice versa.
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
    | "assign_agent_random";
  message_body?: string;
  tag_id?: string;
  media_url?: string;
  media_filename?: string;
  template_id?: string;
  quick_reply_id?: string;
  target_agent_id?: string;
  agent_distribution?: { agent_id: string; percent: number }[];
  delay_seconds?: number;
};

const mediaTypes = new Set(["send_image", "send_video", "send_audio", "send_document"]);
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
    delay_seconds: Math.max(0, Math.min(86400, Math.floor(a.delay_seconds ?? 0))),
  };
}

function validateSequenceActions(actions: ActionInput[]): string | null {
  if (actions.length === 0) return "Agrega al menos un paso de seguimiento.";
  // The DB trigger that kicks off a sequence only fires once, at the
  // moment a message goes unanswered — it can't itself wait, so the first
  // step needs its own delay (e.g. "1 hora") to mean anything.
  if (Math.floor(actions[0].delay_seconds ?? 0) <= 0) {
    return "El primer paso necesita un tiempo de espera mayor a 0 (ej: 1 hora) — es cuánto tiempo sin respuesta debe pasar antes de enviarlo.";
  }
  for (const a of actions) {
    if (mediaTypes.has(a.action_type) && !a.media_url) {
      return "Sube un archivo para cada paso de imagen/video/audio/documento.";
    }
    if (a.action_type === "send_template" && !a.template_id) {
      return "Selecciona una plantilla para cada paso de plantilla.";
    }
    if (a.action_type === "send_quick_reply" && !a.quick_reply_id) {
      return "Selecciona una respuesta rápida para cada paso de ese tipo.";
    }
    if (a.action_type === "assign_agent" && !a.target_agent_id) {
      return "Selecciona el agente para cada paso de asignación.";
    }
    if (a.action_type === "assign_agent_random") {
      const rows = (a.agent_distribution ?? []).filter((d) => d.agent_id && d.percent > 0);
      if (rows.length < 2) {
        return "El aleatorizador necesita al menos 2 agentes con un porcentaje mayor a 0.";
      }
    }
  }
  return null;
}

export async function createFollowupSequence(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const actionsJson = String(formData.get("actionsJson") ?? "[]");
  if (!name) return { error: "El nombre es obligatorio." };

  let actions: ActionInput[];
  try {
    actions = JSON.parse(actionsJson);
  } catch {
    return { error: "Pasos inválidos." };
  }
  const validationError = validateSequenceActions(actions);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: sequence, error } = await supabase
    .from("automations")
    .insert({ workspace_id: workspaceId, name, trigger_type: "no_reply" })
    .select("id")
    .single();
  if (error || !sequence) return { error: error?.message ?? "No se pudo crear." };

  const { error: actionsError } = await supabase
    .from("automation_actions")
    .insert(actions.map((a, index) => actionRow(a, sequence.id, index)));
  if (actionsError) {
    await supabase.from("automations").delete().eq("id", sequence.id);
    return { error: actionsError.message };
  }

  revalidatePath("/dashboard/followups");
  redirect("/dashboard/followups");
}

export async function updateFollowupSequence(_prevState: unknown, formData: FormData) {
  const sequenceId = String(formData.get("sequenceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const actionsJson = String(formData.get("actionsJson") ?? "[]");
  if (!sequenceId) return { error: "Secuencia inválida." };
  if (!name) return { error: "El nombre es obligatorio." };

  let actions: ActionInput[];
  try {
    actions = JSON.parse(actionsJson);
  } catch {
    return { error: "Pasos inválidos." };
  }
  const validationError = validateSequenceActions(actions);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("automations")
    .update({ name })
    .eq("id", sequenceId)
    .eq("workspace_id", workspaceId)
    .eq("trigger_type", "no_reply");
  if (error) return { error: error.message };

  await supabase.from("automation_actions").delete().eq("automation_id", sequenceId);
  const { error: actionsError } = await supabase
    .from("automation_actions")
    .insert(actions.map((a, index) => actionRow(a, sequenceId, index)));
  if (actionsError) return { error: actionsError.message };

  revalidatePath("/dashboard/followups");
  redirect("/dashboard/followups");
}

export async function toggleFollowupSequenceActive(sequenceId: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase
    .from("automations")
    .update({ is_active: isActive })
    .eq("id", sequenceId)
    .eq("trigger_type", "no_reply");
  revalidatePath("/dashboard/followups");
}

export async function deleteFollowupSequence(sequenceId: string) {
  const supabase = await createClient();
  await supabase.from("automations").delete().eq("id", sequenceId).eq("trigger_type", "no_reply");
  revalidatePath("/dashboard/followups");
}

// The per-conversation "no le hagas seguimiento a esta persona" toggle.
export async function setConversationFollowupsEnabled(conversationId: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ followups_enabled: enabled })
    .eq("id", conversationId);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  return { success: true as const };
}
