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
