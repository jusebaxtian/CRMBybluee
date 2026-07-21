"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";

const MAX_AGENTS_PER_WORKSPACE = 3;

async function requireOwnerOrAdmin() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." } as const;

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    return { error: "No tienes permiso para gestionar agentes." } as const;
  }

  return { supabase, workspaceId } as const;
}

export async function createAgentProfile(_prevState: unknown, formData: FormData) {
  const guard = await requireOwnerOrAdmin();
  if ("error" in guard) return guard;
  const { supabase, workspaceId } = guard;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "El nombre es obligatorio." };
  if (!email) return { error: "El correo es obligatorio." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("role", "agent");

  if ((count ?? 0) >= MAX_AGENTS_PER_WORKSPACE) {
    return { error: `Ya tienes el máximo de ${MAX_AGENTS_PER_WORKSPACE} agentes.` };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "No se pudo crear el usuario." };
  }

  const { error: memberError } = await admin.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: created.user.id,
    role: "agent",
  });

  if (memberError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: memberError.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function deleteAgentProfile(userId: string) {
  const guard = await requireOwnerOrAdmin();
  if ("error" in guard) return guard;
  const { workspaceId } = guard;

  const admin = createAdminClient();

  // Free up any conversations assigned to this agent before removing them.
  await admin
    .from("conversations")
    .update({ assigned_agent_id: null })
    .eq("workspace_id", workspaceId)
    .eq("assigned_agent_id", userId);

  await admin
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("role", "agent");

  await admin.auth.admin.deleteUser(userId);

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

export async function assignConversationAgent(conversationId: string, agentId: string | null) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { error } = await supabase
    .from("conversations")
    .update({ assigned_agent_id: agentId })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/inbox");
  return { success: true as const };
}
