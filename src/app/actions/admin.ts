"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";

export async function logAdminAccess(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (!(await isPlatformAdmin(supabase))) return;

  await supabase.from("admin_access_logs").insert({
    admin_user_id: user.id,
    workspace_id: workspaceId,
  });
}

export async function updateWorkspacePlan(workspaceId: string, planId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const { error } = await supabase
    .from("workspaces")
    .update({ plan_id: planId })
    .eq("id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function updateWorkspaceStatus(workspaceId: string, status: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const { error } = await supabase
    .from("workspaces")
    .update({ status })
    .eq("id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin");
  return { success: true };
}
