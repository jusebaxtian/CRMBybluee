import type { SupabaseClient } from "@supabase/supabase-js";
import { addBillingCycle } from "@/lib/billing/cycle";
import { planSeAplica } from "@/lib/billing/cambio-de-plan";

async function getWorkspaceBillingCycle(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data } = await supabase
    .from("workspaces")
    .select("plans(billing_cycle)")
    .eq("id", workspaceId)
    .maybeSingle();
  const plan = data?.plans as unknown as { billing_cycle: string } | null;
  return plan?.billing_cycle ?? "monthly";
}

/**
 * Deja activo el espacio de un pago aprobado, y le pone el plan que compro.
 *
 * El plan del pago solo se aplica si lo pagado es EXACTAMENTE su precio: un
 * pago manual lo escribe el cliente, y sin esta regla bastaria subir un
 * comprobante de $1 marcado como plan superior para que el administrador, al
 * aprobar, regalara el plan. Si no coincide, el espacio se activa con el plan
 * que ya tenia, como antes.
 */
export async function activarPorPago(
  db: SupabaseClient,
  pago: { workspace_id: string; provider: string; amount_cents: number; plan_id: string | null },
  externalId?: string
): Promise<{ planAplicado: boolean }> {
  let ciclo: string | null = null;
  let planAplicado = false;
  if (pago.plan_id) {
    const { data: plan } = await db
      .from("plans")
      .select("price_cents, billing_cycle")
      .eq("id", pago.plan_id)
      .maybeSingle();
    if (plan && planSeAplica(Number(plan.price_cents), Number(pago.amount_cents))) {
      await db.from("workspaces").update({ plan_id: pago.plan_id }).eq("id", pago.workspace_id);
      ciclo = plan.billing_cycle as string;
      planAplicado = true;
    }
  }
  if (!ciclo) ciclo = await getWorkspaceBillingCycle(db, pago.workspace_id);

  await db.from("subscriptions").insert({
    workspace_id: pago.workspace_id,
    provider: pago.provider,
    ...(externalId ? { external_id: externalId } : {}),
    status: "active",
    current_period_end: addBillingCycle(new Date(), ciclo).toISOString(),
  });
  await db.from("workspaces").update({ status: "active" }).eq("id", pago.workspace_id);
  return { planAplicado };
}
