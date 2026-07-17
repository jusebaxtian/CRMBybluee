import { createClient } from "@/lib/supabase/server";
import { NewAutomationForm } from "@/components/new-automation-form";

export default async function NewAutomationPage() {
  const supabase = await createClient();
  const { data: tags } = await supabase.from("tags").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Nueva automatización</h1>
        <NewAutomationForm tags={tags ?? []} />
      </div>
    </div>
  );
}
