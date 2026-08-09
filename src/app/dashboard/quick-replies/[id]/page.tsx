import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewQuickReplyForm } from "@/components/new-quick-reply-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

export default async function EditQuickReplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "quick_replies");

  const { data: quickReply } = await supabase
    .from("quick_replies")
    .select("id, name")
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();

  if (!quickReply) notFound();

  const { data: actions } = await supabase
    .from("quick_reply_actions")
    .select("action_type, message_body, tag_id, media_url, media_filename, template_id")
    .eq("quick_reply_id", id)
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

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h1 className="mb-4 text-lg font-semibold text-foreground">Editar respuesta rápida</h1>
        <NewQuickReplyForm
          tags={tags ?? []}
          templates={templates ?? []}
          quickReply={{
            id: quickReply.id,
            name: quickReply.name,
            actions: actions ?? [],
          }}
        />
      </div>
    </div>
  );
}
