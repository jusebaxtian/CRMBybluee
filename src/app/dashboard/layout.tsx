import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

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
    .select("workspaces(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as { name: string } | undefined;
  const workspaceName = workspace?.name ?? "Tu workspace";

  return (
    <div className="flex bg-background">
      <Sidebar workspaceName={workspaceName} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar workspaceName={workspaceName} userEmail={user.email ?? ""} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
