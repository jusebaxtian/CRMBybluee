"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { executeAction, type AutomationAction } from "@/lib/automations/engine";

type ActionInput = {
  action_type:
    | "send_message"
    | "add_tag"
    | "send_image"
    | "send_video"
    | "send_audio"
    | "send_document"
    | "send_template";
  message_body?: string;
  tag_id?: string;
  media_url?: string;
  media_filename?: string;
  template_id?: string;
};

const mediaTypes = new Set(["send_image", "send_video", "send_audio", "send_document"]);
const captionableTypes = new Set(["send_message", "send_image", "send_video", "send_document"]);

function actionRow(a: ActionInput, quickReplyId: string, index: number) {
  return {
    quick_reply_id: quickReplyId,
    position: index,
    action_type: a.action_type,
    message_body: captionableTypes.has(a.action_type) ? a.message_body || null : null,
    tag_id: a.action_type === "add_tag" ? a.tag_id : null,
    media_url: mediaTypes.has(a.action_type) ? a.media_url : null,
    media_filename: a.action_type === "send_document" ? a.media_filename : null,
    template_id: a.action_type === "send_template" ? a.template_id : null,
  };
}

function validateActions(actions: ActionInput[]): string | null {
  if (actions.length === 0) return "Agrega al menos una acción.";
  for (const a of actions) {
    if (mediaTypes.has(a.action_type) && !a.media_url) {
      return "Sube un archivo para cada acción de imagen/video/audio/documento.";
    }
    if (a.action_type === "send_template" && !a.template_id) {
      return "Selecciona una plantilla para cada acción de plantilla.";
    }
  }
  return null;
}

export async function createQuickReply(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const actionsJson = String(formData.get("actionsJson") ?? "[]");
  if (!name) return { error: "El nombre es obligatorio." };

  let actions: ActionInput[];
  try {
    actions = JSON.parse(actionsJson);
  } catch {
    return { error: "Acciones inválidas." };
  }
  const validationError = validateActions(actions);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: quickReply, error } = await supabase
    .from("quick_replies")
    .insert({ workspace_id: workspaceId, name })
    .select("id")
    .single();

  if (error || !quickReply) return { error: error?.message ?? "No se pudo crear." };

  await supabase
    .from("quick_reply_actions")
    .insert(actions.map((a, index) => actionRow(a, quickReply.id, index)));

  revalidatePath("/dashboard/quick-replies");
  redirect("/dashboard/quick-replies");
}

export async function updateQuickReply(_prevState: unknown, formData: FormData) {
  const quickReplyId = String(formData.get("quickReplyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const actionsJson = String(formData.get("actionsJson") ?? "[]");
  if (!quickReplyId) return { error: "Respuesta rápida inválida." };
  if (!name) return { error: "El nombre es obligatorio." };

  let actions: ActionInput[];
  try {
    actions = JSON.parse(actionsJson);
  } catch {
    return { error: "Acciones inválidas." };
  }
  const validationError = validateActions(actions);
  if (validationError) return { error: validationError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("quick_replies")
    .update({ name })
    .eq("id", quickReplyId);
  if (error) return { error: error.message };

  await supabase.from("quick_reply_actions").delete().eq("quick_reply_id", quickReplyId);
  await supabase
    .from("quick_reply_actions")
    .insert(actions.map((a, index) => actionRow(a, quickReplyId, index)));

  revalidatePath("/dashboard/quick-replies");
  redirect("/dashboard/quick-replies");
}

export async function toggleQuickReplyActive(quickReplyId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quick_replies")
    .update({ is_active: isActive })
    .eq("id", quickReplyId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/quick-replies");
  return { success: true as const };
}

export async function deleteQuickReply(quickReplyId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("quick_replies").delete().eq("id", quickReplyId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/quick-replies");
  return { success: true as const };
}

// Triggered by a single click from the chat — runs every action in order,
// immediately, no delays or run-log (unlike keyword/tag automations, this
// is a synchronous action the agent is actively watching).
export async function sendQuickReply(quickReplyId: string, contactId: string) {
  const supabase = await createClient();

  const { data: quickReply } = await supabase
    .from("quick_replies")
    .select("id, workspace_id")
    .eq("id", quickReplyId)
    .single();
  if (!quickReply) return { error: "Respuesta rápida no encontrada." };

  const { data: actionsRaw } = await supabase
    .from("quick_reply_actions")
    .select(
      "position, action_type, message_body, tag_id, media_url, media_filename, template_id, templates(meta_template_name, language, body_text)"
    )
    .eq("quick_reply_id", quickReplyId)
    .order("position");

  const actions: AutomationAction[] = (actionsRaw ?? []).map((a) => ({
    ...a,
    quick_reply_id: null,
    delay_seconds: 0,
    target_agent_id: null,
    agent_distribution: null,
    templates: a.templates as unknown as
      | { meta_template_name: string; language: string; body_text: string | null }
      | null,
  }));

  try {
    for (const action of actions) {
      await executeAction(supabase, quickReply, contactId, action);
    }
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo enviar." };
  }
}
