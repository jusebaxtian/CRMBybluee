import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuantos agentes de respuesta puede tener un espacio: plan + cupo extra
 * concedido desde admin. Una sola definicion para la accion de crear agente
 * y la pantalla de ajustes, igual que lib/whatsapp/limite-numeros.ts.
 *
 * total = null significa ilimitado (plan sin tope); 0 significa que ni el
 * plan ni el extra permiten agentes.
 */
export async function limiteDeAgentes(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ plan: number | null; extra: number; total: number | null }> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan_id, extra_agents")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: plan } = workspace?.plan_id
    ? await supabase.from("plans").select("max_agents").eq("id", workspace.plan_id).maybeSingle()
    : { data: null };

  const delPlan: number | null = plan?.max_agents ?? null;
  const extra = workspace?.extra_agents ?? 0;
  return { plan: delPlan, extra, total: delPlan === null ? null : delPlan + extra };
}
