import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuantos numeros de WhatsApp puede tener conectados un espacio.
 *
 * Es plan + cupo extra. El extra lo concede admin a un cliente concreto que
 * necesita mas numeros de los que trae su plan, sin cambiarle el plan ni
 * inventar uno para el.
 *
 * Se calculaba en dos sitios (la accion de conectar y la pagina de ajustes)
 * y cada uno leia solo el plan. Una sola definicion para que el extra cuente
 * en los dos.
 */
export async function limiteDeNumeros(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ plan: number; extra: number; total: number }> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("plan_id, extra_whatsapp_numbers")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: plan } = workspace?.plan_id
    ? await supabase.from("plans").select("max_whatsapp_numbers").eq("id", workspace.plan_id).maybeSingle()
    : { data: null };

  const delPlan = plan?.max_whatsapp_numbers ?? 1;
  const extra = workspace?.extra_whatsapp_numbers ?? 0;
  return { plan: delPlan, extra, total: delPlan + extra };
}
