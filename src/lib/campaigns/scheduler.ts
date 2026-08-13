import { createAdminClient } from "@/lib/supabase/admin";
import { executeCampaignSend } from "@/lib/campaigns/send";

// Picks up draft campaigns whose scheduled_at has arrived and sends them —
// the counterpart to the manual "Enviar" button for campaigns the user
// scheduled ahead of time instead of sending immediately.
export async function processDueCampaigns() {
  const supabase = createAdminClient();

  const { data: due } = await supabase
    .from("campaigns")
    .select("id, workspace_id")
    .eq("status", "draft")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  for (const campaign of due ?? []) {
    // Claim it first (draft -> sending) so a slow send doesn't get picked
    // up again by the next tick — same claim-then-act pattern as the
    // automation scheduler.
    const { data: claimed } = await supabase
      .from("campaigns")
      .update({ status: "sending" })
      .eq("id", campaign.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    await executeCampaignSend(supabase, campaign.workspace_id, campaign.id);
  }
}
