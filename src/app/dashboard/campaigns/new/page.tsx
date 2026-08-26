import { createClient } from "@/lib/supabase/server";
import { NewCampaignForm } from "@/components/new-campaign-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "campaigns");

  const { data: templates } = await supabase
    .from("templates")
    .select("id, meta_template_name, status")
    .eq("workspace_id", workspaceId ?? "")
    .eq("status", "APPROVED")
    .order("meta_template_name");

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, excludes_followups")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const { data: whatsappAccounts } = await supabase
    .from("whatsapp_accounts")
    .select("id, label, display_phone_number")
    .eq("workspace_id", workspaceId ?? "")
    .neq("status", "frozen")
    .order("connected_at");

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Nueva campaña</h1>
        <NewCampaignForm
          templates={templates ?? []}
          tags={tags ?? []}
          whatsappAccounts={whatsappAccounts ?? []}
        />
      </div>
    </div>
  );
}
