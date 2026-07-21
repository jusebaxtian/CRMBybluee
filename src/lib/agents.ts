import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lists the agent-role members of a workspace with their email/name, for use in dropdowns. */
export async function listWorkspaceAgents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null
) {
  if (!workspaceId) return [];

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "agent");

  if (!members || members.length === 0) return [];

  const admin = createAdminClient();
  const agents = await Promise.all(
    members.map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return {
        id: m.user_id,
        email: data.user?.email ?? "—",
        name: (data.user?.user_metadata?.full_name as string | undefined) ?? null,
      };
    })
  );

  return agents;
}
