"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { getWorkspaceId } from "@/lib/workspace";

export async function createNotification(_prevState: unknown, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const scope = String(formData.get("scope") ?? "all") as "all" | "workspace" | "plan" | "status";
  const targetWorkspaceId = String(formData.get("targetWorkspaceId") ?? "") || null;
  const targetPlanId = String(formData.get("targetPlanId") ?? "") || null;
  const targetStatus = String(formData.get("targetStatus") ?? "") || null;
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
  const ctaUrl = String(formData.get("ctaUrl") ?? "").trim();

  if (!title || !body) return { error: "Título y contenido son obligatorios." };
  if (scope === "status" && !targetStatus) {
    return { error: "Selecciona el estado de cuenta al que debe llegar." };
  }
  if (ctaUrl && !ctaLabel) return { error: "Si pones una URL, agrégale también un texto de botón." };
  if (ctaLabel && !ctaUrl) return { error: "Si pones un texto de botón, agrégale también la URL." };

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
    target_status: scope === "status" ? targetStatus : null,
    starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
    ends_at: endsAt ? new Date(`${endsAt}T23:59:59`).toISOString() : null,
    cta_label: ctaLabel || null,
    cta_url: ctaUrl || null,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/notifications");
  return { success: true };
}

export async function deleteNotification(notificationId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  // notification_reads cascades via FK — clients lose it from their bell
  // the moment this row is gone (plus the realtime DELETE event for anyone
  // with the dashboard already open).
  const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
  if (error) return { error: error.message };

  revalidatePath("/admin/notifications");
  return { success: true as const };
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
