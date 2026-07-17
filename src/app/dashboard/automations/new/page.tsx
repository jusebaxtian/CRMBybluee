import { createClient } from "@/lib/supabase/server";
import { NewAutomationForm } from "@/components/new-automation-form";
import { getWorkspaceId } from "@/lib/workspace";

export default async function NewAutomationPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  const { data: tags } = await supabase
    .from("tags")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Nueva automatización</h1>
        <NewAutomationForm tags={tags ?? []} />
      </div>
    </div>
  );
}
