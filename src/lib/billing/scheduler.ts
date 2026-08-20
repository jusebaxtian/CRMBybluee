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
