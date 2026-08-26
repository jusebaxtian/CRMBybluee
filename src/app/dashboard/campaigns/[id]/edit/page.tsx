import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewCampaignForm, type CampaignInitialValues } from "@/components/new-campaign-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "campaigns");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, name, status, send_type, template_id, message_body, media_url, media_filename, audience_tag_ids, audience_exclude_tag_ids, audience_created_from, audience_created_to, audience_window, scheduled_at, whatsapp_account_id"
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();

  if (!campaign) notFound();
  if (campaign.status !== "draft") notFound();

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

  const initialValues: CampaignInitialValues = {
    name: campaign.name,
    sendType: campaign.send_type as "template" | "free_text",
    templateId: campaign.template_id,
    messageBody: campaign.message_body,
    mediaUrl: campaign.media_url,
    mediaFilename: campaign.media_filename,
    includeTagIds: campaign.audience_tag_ids ?? [],
    excludeTagIds: campaign.audience_exclude_tag_ids ?? [],
    createdFrom: campaign.audience_created_from ? campaign.audience_created_from.slice(0, 10) : null,
    createdTo: campaign.audience_created_to ? campaign.audience_created_to.slice(0, 10) : null,
    audienceWindow: campaign.audience_window as "all" | "open",
    scheduledAt: campaign.scheduled_at,
    whatsappAccountId: campaign.whatsapp_account_id,
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Editar campaña</h1>
        <NewCampaignForm
          templates={templates ?? []}
          tags={tags ?? []}
          whatsappAccounts={whatsappAccounts ?? []}
          mode="edit"
          campaignId={campaign.id}
          initialValues={initialValues}
        />
      </div>
    </div>
  );
}
