import { createClient } from "@/lib/supabase/server";
import { NewCampaignForm } from "@/components/new-campaign-form";

export default async function NewCampaignPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("id, meta_template_name, status")
    .eq("status", "APPROVED")
    .order("meta_template_name");

  const { data: tags } = await supabase.from("tags").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Nueva campaña</h1>
        <NewCampaignForm templates={templates ?? []} tags={tags ?? []} />
      </div>
    </div>
  );
}
