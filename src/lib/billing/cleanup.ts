import { createAdminClient } from "@/lib/supabase/admin";

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Permanently deletes workspaces that never once activated (no successful
// payment, ever) and have been sitting in past_due for 7+ days — cleans up
// abandoned signups that never paid. Deliberately scoped to ONLY
// ever_activated = false: a workspace that paid before and later lapsed is
// left alone for manual review, not auto-deleted (product decision).
// Deletion cascades to every child table (contacts, conversations,
// messages, campaigns, etc.) via ON DELETE CASCADE — this is irreversible,
// so every deletion is logged with enough detail to explain it after the
// fact.
export async function deleteStaleUnactivatedWorkspaces() {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();

  const { data: stale } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .eq("status", "past_due")
    .eq("ever_activated", false)
    .lt("created_at", cutoff);

  for (const workspace of stale ?? []) {
    const { error } = await supabase.from("workspaces").delete().eq("id", workspace.id);
    if (error) {
      console.error(`auto-delete failed for workspace ${workspace.id} (${workspace.name}):`, error.message);
    } else {
      console.log(
        `auto-deleted unactivated workspace ${workspace.id} ("${workspace.name}", created ${workspace.created_at}) — past_due 7+ days, never activated`
      );
    }
  }
}
