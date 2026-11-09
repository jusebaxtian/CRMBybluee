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

/**
 * Todos los que pueden tener chats asignados (dueno, administradores y asesores),
 * con su nombre, para filtrar Leads y campanas por asesor (0179).
 */
export async function personasConChats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null
): Promise<{ id: string; nombre: string; rol: string }[]> {
  if (!workspaceId) return [];
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .in("role", ["owner", "admin", "agent"]);
  if (!members || members.length === 0) return [];

  const admin = createAdminClient();
  const personas = await Promise.all(
    members.map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id as string);
      const nombre = (data.user?.user_metadata?.full_name as string | undefined)?.trim() || data.user?.email || "Sin nombre";
      return { id: m.user_id as string, nombre, rol: m.role as string };
    })
  );
  // Primero el dueno, luego por nombre.
  return personas.sort((a, b) => (a.rol === "owner" ? -1 : b.rol === "owner" ? 1 : a.nombre.localeCompare(b.nombre, "es")));
}
