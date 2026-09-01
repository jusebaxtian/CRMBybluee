import { createClient } from "@/lib/supabase/server";
import { NewFollowupSequenceForm } from "@/components/new-followup-sequence-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { listWorkspaceAgents } from "@/lib/agents";

export default async function NewFollowupSequencePage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "followups");

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const { data: templates } = await supabase
    .from("templates")
    .select("id, meta_template_name, language, status")
    .eq("workspace_id", workspaceId ?? "")
    .eq("created_via", "crm")
    .neq("status", "DELETED")
    .order("meta_template_name");

  const { data: quickReplies } = await supabase
    .from("quick_replies")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .eq("is_active", true)
    .order("name");

  const agents = await listWorkspaceAgents(supabase, workspaceId);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Nuevo seguimiento</h1>
        <NewFollowupSequenceForm
          tags={tags ?? []}
          templates={templates ?? []}
          agents={agents}
          quickReplies={quickReplies ?? []}
        />
      </div>
    </div>
  );
}
