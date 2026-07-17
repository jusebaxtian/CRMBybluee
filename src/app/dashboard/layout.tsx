import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
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
        .select("name, plan_id")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };

  const workspaceName = workspace?.name ?? "Tu workspace";

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
    <div className="flex bg-background">
      <Sidebar workspaceName={workspaceName} isPlatformAdmin={isAdmin} />
      <div className="flex min-h-screen flex-1 flex-col">
        {impersonatedWorkspaceId && (
          <ImpersonationBanner workspaceName={workspaceName} />
        )}
        <Topbar
          workspaceName={workspaceName}
          userEmail={user.email ?? ""}
          notifications={notificationsWithRead}
        />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
