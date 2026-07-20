"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";

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
  delay_seconds?: number;
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
    delay_seconds: Math.max(0, Math.min(86400, Math.floor(a.delay_seconds ?? 0))),
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
  const triggerType = String(formData.get("triggerType") ?? "") as "tag_added" | "keyword";
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
  }

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: automation, error } = await supabase
    .from("automations")
    .insert({
      workspace_id: workspaceId,
      name,
      trigger_type: triggerType,
      trigger_tag_id: triggerType === "tag_added" ? triggerTagId : null,
      trigger_keyword: triggerType === "keyword" ? triggerKeyword : null,
    })
    .select("id")
    .single();

  if (error || !automation) return { error: error?.message ?? "No se pudo crear." };

  await supabase
    .from("automation_actions")
    .insert(actions.map((a, index) => actionRow(a, automation.id, index)));

  revalidatePath("/dashboard/automations");
  redirect("/dashboard/automations");
}

export async function updateAutomation(_prevState: unknown, formData: FormData) {
  const automationId = String(formData.get("automationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const triggerType = String(formData.get("triggerType") ?? "") as "tag_added" | "keyword";
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
      trigger_keyword: triggerType === "keyword" ? triggerKeyword : null,
    })
    .eq("id", automationId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  await supabase.from("automation_actions").delete().eq("automation_id", automationId);
  await supabase
    .from("automation_actions")
    .insert(actions.map((a, index) => actionRow(a, automationId, index)));

  revalidatePath("/dashboard/automations");
  redirect("/dashboard/automations");
}

export async function toggleAutomationActive(automationId: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from("automations").update({ is_active: isActive }).eq("id", automationId);
  revalidatePath("/dashboard/automations");
}

export async function deleteAutomation(automationId: string) {
  const supabase = await createClient();
  await supabase.from("automations").delete().eq("id", automationId);
  revalidatePath("/dashboard/automations");
}
