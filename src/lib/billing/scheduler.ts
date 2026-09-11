import { createAdminClient } from "@/lib/supabase/admin";

// Flips workspaces whose free trial ran out to "past_due" — the same status
// used for a lapsed paid subscription — so the middleware billing lockout
// (dashboard/inbox/etc. redirect to /dashboard/billing) kicks in without an
// admin having to do it by hand.
export async function expireTrials() {
  const supabase = createAdminClient();

  await supabase
    .from("workspaces")
    .update({ status: "past_due" })
    .eq("status", "trialing")
    .lt("trial_ends_at", new Date().toISOString());
}

// Counterpart for paying customers: flips "active" to "past_due" the
// instant a workspace's real renewal date (the latest current_period_end
// among its active subscriptions) passes, so the existing billing lockout
// kicks in without an admin having to notice and do it by hand. These
// workspaces are protected from the 7-day auto-delete (ever_activated is
// already true) — this only locks access until they renew, same as a
// never-activated signup would.
export async function expireLapsedActiveSubscriptions() {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("expire_lapsed_active_subscriptions");
  if (error) console.error("expire_lapsed_active_subscriptions failed:", error.message);
}

/**
 * Borra ordenes de Bold que nunca llegaron a ser un pago.
 *
 * La pagina de Facturacion tiene que crear la orden al renderizar: el boton de
 * Bold es un <script> con la orden, el monto y la firma en sus atributos, y su
 * libreria los lee al cargar. Asi que abrir la pagina y no pagar deja una fila
 * "pending" que nunca fue un intento real de pago. Se acumulaban hasta llenar
 * la lista de pagos del panel: 25 de 33 filas eran basura de este tipo.
 *
 * Solo se borran las que llevan mas de un dia sin confirmarse. El margen es
 * deliberado: confirmBoldPayment busca la fila por bold_order_id y exige que
 * siga "pending", asi que borrar una mientras el cliente esta pagando le
 * cobraria sin activarle el plan.
 *
 * Nunca toca transferencias manuales ni nada con comprobante o ya revisado.
 */
export async function cleanupAbandonedBoldOrders() {
  const supabase = createAdminClient();
  const corte = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("provider", "bold")
    .eq("status", "pending")
    .is("proof_path", null)
    .is("reviewed_at", null)
    .lt("created_at", corte);

  if (error) console.error("cleanupAbandonedBoldOrders failed:", error.message);
}
