import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewAutomationForm } from "@/components/new-automation-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { listWorkspaceAgents } from "@/lib/agents";

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "automations");

  const { data: automation } = await supabase
    .from("automations")
    .select("id, name, trigger_type, trigger_tag_id, trigger_keyword")
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();

  if (!automation) notFound();

  const { data: actions } = await supabase
    .from("automation_actions")
    .select(
      "action_type, message_body, tag_id, media_url, media_filename, template_id, quick_reply_id, target_agent_id, agent_distribution, delay_seconds"
    )
    .eq("automation_id", id)
    .order("position", { ascending: true });

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const { data: templates } = await supabase
    .from("templates")
    .select("id, meta_template_name, language, status")
    .eq("workspace_id", workspaceId ?? "")
    .neq("status", "DELETED")
    .order("meta_template_name");

  const agents = await listWorkspaceAgents(supabase, workspaceId);

  const { data: quickReplies } = await supabase
    .from("quick_replies")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Editar automatización</h1>
        <NewAutomationForm
          tags={tags ?? []}
          templates={templates ?? []}
          agents={agents}
          quickReplies={quickReplies ?? []}
          automation={{
            id: automation.id,
            name: automation.name,
            trigger_type: automation.trigger_type as "tag_added" | "keyword",
            trigger_tag_id: automation.trigger_tag_id,
            trigger_keyword: automation.trigger_keyword,
            actions: actions ?? [],
          }}
        />
      </div>
    </div>
  );
}
