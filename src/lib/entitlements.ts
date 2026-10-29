import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";

export async function getEnabledModuleKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null
): Promise<string[]> {
  if (!workspaceId) return [];

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace?.plan_id) return [];

  // Los del plan + los que el administrador le habilito a este espacio (0162).
  const [{ data: planModules }, { data: extra }] = await Promise.all([
    supabase.from("plan_modules").select("module_key").eq("plan_id", workspace.plan_id),
    supabase.from("workspace_modulos_extra").select("module_key").eq("workspace_id", workspaceId),
  ]);

  return [...new Set([...(planModules ?? []), ...(extra ?? [])].map((m) => m.module_key as string))];
}

/** Redirects to /dashboard if the workspace's plan doesn't include this module. */
export async function requireModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null,
  moduleKey: string
) {
  const enabled = await getEnabledModuleKeys(supabase, workspaceId);
  if (!enabled.includes(moduleKey)) {
    redirect("/dashboard?locked=" + moduleKey);
  }
}
