import { createClient } from "@/lib/supabase/server";
import { NewQuickReplyForm } from "@/components/new-quick-reply-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

export default async function NewQuickReplyPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "quick_replies");

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

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Nueva respuesta rápida</h1>
        <NewQuickReplyForm tags={tags ?? []} templates={templates ?? []} />
      </div>
    </div>
  );
}
