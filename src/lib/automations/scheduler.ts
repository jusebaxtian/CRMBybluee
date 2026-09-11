import { createAdminClient } from "@/lib/supabase/admin";
import { resumeAutomationRun, isContactExcludedFromFollowups } from "@/lib/automations/engine";

// Picks up automation actions that were deferred with a delay and are now
// due, and resumes them from where they left off. Runs in-process (see
// instrumentation.ts) since there's no external job queue — each due run is
// claimed (deleted, and the delete verified to have removed the row) before
// executing, so neither a slow tick nor a second process can double-send it.
export async function processDueAutomationRuns() {
  const supabase = createAdminClient();

  // A paused row (contact replied — see handle_message_for_followups()) has
  // an old run_at that's already in the past, but must NOT fire until the
  // next outbound message re-arms it 30 minutes out and clears the pause.
  const { data: dueRuns } = await supabase
    .from("automation_pending_runs")
    .select("id, workspace_id, automation_id, contact_id, next_position, automations(trigger_type)")
    .eq("paused", false)
    .lte("run_at", new Date().toISOString())
    .limit(50);

  for (const run of dueRuns ?? []) {
    // Se comprueba que el borrado se haya llevado la fila, no solo que no
    // diera error. Un DELETE que no encuentra nada devuelve error nulo: con
    // dos procesos, los dos leen la misma tarea vencida, los dos la borran, y
    // el segundo seguiria adelante creyendo que la reclamo. El mensaje le
    // llegaria dos veces al cliente.
    //
    // `.select("id")` hace que PostgREST devuelva las filas borradas, y solo
    // una de las dos carreras recibe una.
    const { data: reclamada, error: claimError } = await supabase
      .from("automation_pending_runs")
      .delete()
      .eq("id", run.id)
      .select("id")
      .maybeSingle();
    if (claimError || !reclamada) continue;

    // If this due run is the WAIT_FOR_REPLY_TIMEOUT_SECONDS fallback for a
    // "wait_for_reply" step (see engine.ts), the contact never answered in
    // time — cancel the matching reply-wait so a late reply doesn't ALSO
    // resume this same step again. A no-op for every other kind of run,
    // since those never have a matching row here.
    await supabase
      .from("automation_reply_waits")
      .delete()
      .eq("automation_id", run.automation_id)
      .eq("contact_id", run.contact_id)
      .eq("next_position", run.next_position);

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
