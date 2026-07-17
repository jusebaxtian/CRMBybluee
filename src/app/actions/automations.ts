"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

type ActionInput = {
  action_type: "send_message" | "add_tag";
  message_body?: string;
  tag_id?: string;
};

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

  await supabase.from("automation_actions").insert(
    actions.map((a, index) => ({
      automation_id: automation.id,
      position: index,
      action_type: a.action_type,
      message_body: a.action_type === "send_message" ? a.message_body : null,
      tag_id: a.action_type === "add_tag" ? a.tag_id : null,
    }))
  );

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
