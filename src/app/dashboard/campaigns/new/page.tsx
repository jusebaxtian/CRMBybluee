import { createClient } from "@/lib/supabase/server";
import { NewCampaignForm } from "@/components/new-campaign-form";
import { getWorkspaceId } from "@/lib/workspace";

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  const { data: templates } = await supabase
    .from("templates")
    .select("id, meta_template_name, status")
    .eq("workspace_id", workspaceId ?? "")
    .eq("status", "APPROVED")
    .order("meta_template_name");

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Nueva campaña</h1>
        <NewCampaignForm templates={templates ?? []} tags={tags ?? []} />
      </div>
    </div>
  );
}
