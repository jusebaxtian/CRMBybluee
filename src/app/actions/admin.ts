"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { IMPERSONATION_COOKIE } from "@/lib/workspace";
import { toPublicUrl } from "@/lib/supabase/config";

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

export async function startImpersonation(workspaceId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return;

  await logAdminAccess(workspaceId);

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, workspaceId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours
  });

  redirect("/dashboard");
}

export async function stopImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
  redirect("/admin");
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

export async function toggleWorkspaceAccess(workspaceId: string, disabled: boolean) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const { error } = await supabase
    .from("workspaces")
    .update({ access_disabled: disabled })
    .eq("id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteWorkspace(workspaceId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  const admin = createAdminClient();

  // Deletes the workspace row, which cascades to every table that references
  // it (contacts, conversations, messages, campaigns, automations, payments,
  // subscriptions, etc.) before the owner accounts themselves are removed.
  const { error } = await admin.from("workspaces").delete().eq("id", workspaceId);
  if (error) return { error: error.message };

  for (const member of members ?? []) {
    await admin.auth.admin.deleteUser(member.user_id);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function updateWorkspaceName(workspaceId: string, name: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!name.trim()) return { error: "El nombre no puede estar vacío." };

  const { error } = await supabase
    .from("workspaces")
    .update({ name: name.trim() })
    .eq("id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function updateWorkspacePhone(workspaceId: string, phone: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const { error } = await supabase
    .from("workspaces")
    .update({ phone: phone.trim().replace(/[^\d]/g, "") || null })
    .eq("id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { success: true };
}

// Edits the date that gates access for this workspace — trial_ends_at while
// they're on a trial (so a trial can be extended or shortened and the
// scheduler in src/lib/billing/scheduler.ts picks up the new date as-is,
// no extra recompute needed), or the active subscription's current_period_end
// once they're a paying customer.
export async function updateWorkspaceRenewalDate(workspaceId: string, newDate: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!newDate) return { error: "Selecciona una fecha válida." };

  const isoDate = new Date(`${newDate}T23:59:59`).toISOString();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("status")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) return { error: "Workspace no encontrado." };

  if (workspace.status === "trialing") {
    const { error } = await supabase
      .from("workspaces")
      .update({ trial_ends_at: isoDate })
      .eq("id", workspaceId);
    if (error) return { error: error.message };
  } else {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscription) {
      const { error } = await supabase
        .from("subscriptions")
        .update({ current_period_end: isoDate })
        .eq("id", subscription.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("subscriptions").insert({
        workspace_id: workspaceId,
        provider: "manual",
        status: "active",
        current_period_end: isoDate,
      });
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { success: true as const };
}

export async function updateOwnerEmail(userId: string, email: string, workspaceId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!email.trim()) return { error: "El correo no puede estar vacío." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: email.trim(),
    email_confirm: true,
  });

  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function updateOwnerPassword(userId: string, password: string, workspaceId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });

  if (error) return { error: error.message };
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { success: true };
}

export async function updateDashboardBanner(formData: FormData) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const file = formData.get("banner") as File | null;
  if (!file || file.size === 0) return { error: "Selecciona una imagen." };

  const admin = createAdminClient();
  const ext = file.name.split(".").pop() ?? "png";
  const path = `banner.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("banners")
    .upload(path, file, { upsert: true });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl: rawPublicUrl },
  } = admin.storage.from("banners").getPublicUrl(path);
  const publicUrl = toPublicUrl(rawPublicUrl);

  // Cache-bust so clients see the new image immediately instead of the
  // previous file under the same path/URL.
  const bustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error } = await admin
    .from("platform_settings")
    .upsert(
      { key: "dashboard_banner_url", value: bustedUrl, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/admin/banner");
  return { success: true };
}

export async function updateSupportWhatsapp(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const number = String(formData.get("number") ?? "").trim().replace(/[^\d]/g, "");
  const message = String(formData.get("message") ?? "").trim();

  if (!number) return { error: "Ingresa el número de WhatsApp (con indicativo, sin +)." };
  if (!message) return { error: "Escribe el mensaje predeterminado." };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await admin.from("platform_settings").upsert(
    [
      { key: "support_whatsapp_number", value: number, updated_at: now },
      { key: "support_whatsapp_message", value: message, updated_at: now },
    ],
    { onConflict: "key" }
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/support");
  revalidatePath("/dashboard", "layout");
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
