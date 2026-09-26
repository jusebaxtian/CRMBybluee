import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewFollowupSequenceForm } from "@/components/automations/new-followup-sequence-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { listWorkspaceAgents } from "@/lib/agents";
import { noSePuedeUsar } from "@/lib/whatsapp/limite-plantilla";

export default async function EditFollowupSequencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "followups");

  const { data: sequence } = await supabase
    .from("automations")
    .select("id, name, required_tag_id, whatsapp_account_id")
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .eq("trigger_type", "no_reply")
    .maybeSingle();

  if (!sequence) notFound();

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
    .select("id, meta_template_name, language, status, waba_id, body_text")
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

  // Lineas del espacio: con mas de una, la regla puede limitarse a una
  // (migracion 0109) y las plantillas se filtran por su WABA.
  const { data: lineas } = await supabase
    .from("whatsapp_accounts")
    .select("id, label, display_phone_number, waba_id")
    .eq("workspace_id", workspaceId ?? "")
    .neq("status", "frozen")
    .order("connected_at");


  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-[13px] border border-border bg-surface p-6">
        <h1 className="mb-4 font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Editar seguimiento</h1>
        <NewFollowupSequenceForm
          tags={tags ?? []}
          templates={(templates ?? []).filter((t) => !noSePuedeUsar(t.body_text))}
          lineas={lineas ?? []}
          agents={agents}
          quickReplies={quickReplies ?? []}
          sequence={{
            id: sequence.id,
            name: sequence.name,
            whatsappAccountId: sequence.whatsapp_account_id,
            actions: actions ?? [],
            requiredTagId: sequence.required_tag_id,
          }}
        />
      </div>
    </div>
  );
}
