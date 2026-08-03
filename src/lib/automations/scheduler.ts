import { createAdminClient } from "@/lib/supabase/admin";
import { resumeAutomationRun, isContactExcludedFromFollowups } from "@/lib/automations/engine";

// Picks up automation actions that were deferred with a delay and are now
// due, and resumes them from where they left off. Runs in-process (see
// instrumentation.ts) since there's no external job queue — each due run is
// claimed (deleted) before executing so a slow tick can't double-process it.
export async function processDueAutomationRuns() {
  const supabase = createAdminClient();

  const { data: dueRuns } = await supabase
    .from("automation_pending_runs")
    .select("id, workspace_id, automation_id, contact_id, next_position, automations(trigger_type)")
    .lte("run_at", new Date().toISOString())
    .limit(50);

  for (const run of dueRuns ?? []) {
    const { error: claimError } = await supabase
      .from("automation_pending_runs")
      .delete()
      .eq("id", run.id);
    if (claimError) continue;

    // A "No interesados" tag (or the conversation's own toggle) may have
    // been applied any time during the wait — re-check right before firing,
    // not just when the sequence was first scheduled.
    const triggerType = (run.automations as unknown as { trigger_type: string } | null)?.trigger_type;
    if (triggerType === "no_reply" && (await isContactExcludedFromFollowups(supabase, run.contact_id))) {
      continue;
    }

    await resumeAutomationRun(
      supabase,
      { id: run.automation_id, workspace_id: run.workspace_id },
      run.contact_id,
      run.next_position
    );
  }
}
