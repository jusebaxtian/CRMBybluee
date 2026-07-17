import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { isPlatformAdmin } from "@/lib/admin";

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

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(name, plan_id)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as
    | { name: string; plan_id: string | null }
    | undefined;
  const workspaceName = workspace?.name ?? "Tu workspace";
  const workspaceId = membership?.workspace_id;

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

  const isAdmin = await isPlatformAdmin(supabase);

  return (
    <div className="flex bg-background">
      <Sidebar workspaceName={workspaceName} isPlatformAdmin={isAdmin} />
      <div className="flex min-h-screen flex-1 flex-col">
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
