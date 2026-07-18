import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardChrome } from "@/components/dashboard-chrome";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { isPlatformAdmin } from "@/lib/admin";
import { getWorkspaceId, getImpersonatedWorkspaceId } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await isPlatformAdmin(supabase);
  const impersonatedWorkspaceId = isAdmin ? await getImpersonatedWorkspaceId() : null;
  const workspaceId = await getWorkspaceId(supabase);

  const { data: workspace } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("name, plan_id, access_disabled")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };

  // Admins bypass this while impersonating — they need to be able to inspect
  // a disabled account for support.
  if (workspace?.access_disabled && !impersonatedWorkspaceId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Cuenta desactivada</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Tu acceso a esta cuenta fue desactivado. Contacta a soporte si crees que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  const workspaceName = workspace?.name ?? "Tu workspace";

  const { data: planModules } = workspace?.plan_id
    ? await supabase
        .from("plan_modules")
        .select("module_key")
        .eq("plan_id", workspace.plan_id)
    : { data: [] };
  const enabledModules = (planModules ?? []).map((pm) => pm.module_key);

  // Explicit scope filter — RLS also allows platform admins to read every notification,
  // which would otherwise leak other clients' targeted notifications into an admin's own dashboard.
  const scopeFilter = workspace?.plan_id
    ? `scope.eq.all,and(scope.eq.workspace,target_workspace_id.eq.${workspaceId}),and(scope.eq.plan,target_plan_id.eq.${workspace.plan_id})`
    : `scope.eq.all,and(scope.eq.workspace,target_workspace_id.eq.${workspaceId})`;

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, created_at")
    .or(scopeFilter)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: reads } = workspaceId
    ? await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("workspace_id", workspaceId)
    : { data: [] };

  const readIds = new Set((reads ?? []).map((r) => r.notification_id));
  const notificationsWithRead = (notifications ?? []).map((n) => ({
    ...n,
    read: readIds.has(n.id),
  }));

  return (
    <DashboardChrome
      workspaceName={workspaceName}
      isPlatformAdmin={isAdmin}
      enabledModules={enabledModules}
      userEmail={user.email ?? ""}
      notifications={notificationsWithRead}
      banner={
        impersonatedWorkspaceId ? <ImpersonationBanner workspaceName={workspaceName} /> : null
      }
    >
      {children}
    </DashboardChrome>
  );
}
