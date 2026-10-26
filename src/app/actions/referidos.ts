"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { requireWorkspaceRole } from "@/lib/auth/with-workspace";

/** Usa un mes gratis ganado: se suma al final del periodo vigente. */
export async function canjearMesReferido(): Promise<{ error: string } | { success: true; hasta: string }> {
  const ctx = await requireWorkspaceRole(["owner", "admin"], "Solo el dueño o un administrador puede usar los meses gratis.");
  if ("error" in ctx) return { error: ctx.error };

  const { data, error } = await createAdminClient().rpc("canjear_mes_referido", { p_workspace: ctx.workspaceId });
  if (error) {
    console.error("canjearMesReferido:", error.message);
    return { error: "No se pudo usar el mes gratis. Intenta de nuevo." };
  }
  if (!data) return { error: "No tienes meses gratis disponibles." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/billing");
  return { success: true as const, hasta: String(data) };
}

/** Admin: aprueba o rechaza un referido marcado "en revision". */
export async function resolverReferido(rewardId: string, aprobar: boolean): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  const { error } = await createAdminClient().rpc("resolver_referido", { p_reward: rewardId, p_aprobar: aprobar });
  if (error) return { error: "No se pudo guardar la decisión." };
  revalidatePath("/admin/fidelidad");
  return { success: true as const };
}
