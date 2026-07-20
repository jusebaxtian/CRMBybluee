import { createAdminClient } from "@/lib/supabase/admin";
import { resumeAutomationRun } from "@/lib/automations/engine";

// Picks up automation actions that were deferred with a delay and are now
// due, and resumes them from where they left off. Runs in-process (see
// instrumentation.ts) since there's no external job queue — each due run is
// claimed (deleted) before executing so a slow tick can't double-process it.
export async function processDueAutomationRuns() {
  const supabase = createAdminClient();

  const { data: dueRuns } = await supabase
    .from("automation_pending_runs")
    .select("id, workspace_id, automation_id, contact_id, next_position")
    .lte("run_at", new Date().toISOString())
    .limit(50);

  for (const run of dueRuns ?? []) {
    const { error: claimError } = await supabase
      .from("automation_pending_runs")
      .delete()
      .eq("id", run.id);
    if (claimError) continue;

    await resumeAutomationRun(
      supabase,
      { id: run.automation_id, workspace_id: run.workspace_id },
      run.contact_id,
      run.next_position
    );
  }
}
