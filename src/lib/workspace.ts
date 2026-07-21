import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";

export const IMPERSONATION_COOKIE = "impersonate_workspace_id";

/**
 * Resolves the workspace the current request should act on: the impersonated
 * workspace if a platform admin has one active, otherwise the caller's own
 * workspace membership.
 */
export async function getWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const cookieStore = await cookies();
  const impersonatedId = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  if (impersonatedId) {
    const isAdmin = await isPlatformAdmin(supabase);
    if (isAdmin) return impersonatedId;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return membership?.workspace_id ?? null;
}

export async function getImpersonatedWorkspaceId() {
  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
}

/** The caller's role within the given workspace ('owner' | 'admin' | 'agent'), or null. */
export async function getWorkspaceRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null
) {
  if (!workspaceId) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.role ?? null;
}
