"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { getWorkspaceId } from "@/lib/workspace";

export async function createNotification(_prevState: unknown, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const scope = String(formData.get("scope") ?? "all") as "all" | "workspace" | "plan";
  const targetWorkspaceId = String(formData.get("targetWorkspaceId") ?? "") || null;
  const targetPlanId = String(formData.get("targetPlanId") ?? "") || null;

  if (!title || !body) return { error: "Título y contenido son obligatorios." };

  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("notifications").insert({
    title,
    body,
    scope,
    target_workspace_id: scope === "workspace" ? targetWorkspaceId : null,
    target_plan_id: scope === "plan" ? targetPlanId : null,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/notifications");
  return { success: true };
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return;

  await supabase
    .from("notification_reads")
    .upsert({ notification_id: notificationId, workspace_id: workspaceId });

  revalidatePath("/dashboard");
}
