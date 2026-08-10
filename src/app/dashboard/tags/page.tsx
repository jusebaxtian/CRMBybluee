import { Tag as TagIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateTagForm } from "@/components/create-tag-form";
import { DeleteTagButton } from "@/components/delete-tag-button";
import { EditTagButton } from "@/components/edit-tag-button";
import { TagFollowupsToggle } from "@/components/tag-followups-toggle";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule, getEnabledModuleKeys } from "@/lib/entitlements";
import { CampaignsTabs } from "@/components/campaigns-tabs";

export default async function TagsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "tags");
  const enabledModules = await getEnabledModuleKeys(supabase, workspaceId);

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, color, excludes_followups, marks_purchase, contact_tags(count)")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <CampaignsTabs enabledModules={enabledModules} />

      <div className="rounded-xl border border-border bg-surface p-5">
        <CreateTagForm />
      </div>

      {!tags || tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <TagIcon size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Todavía no tienes etiquetas
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea etiquetas para segmentar tus contactos, por ejemplo &quot;Cliente&quot;, &quot;Interesado&quot; o &quot;VIP&quot;.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const contactCount = (tag.contact_tags as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm"
                style={{ color: tag.color, borderColor: tag.color }}
              >
                <span>
                  {tag.name}{" "}
                  <span className="text-muted" title={`${contactCount} contacto${contactCount === 1 ? "" : "s"} con esta etiqueta`}>
                    {contactCount}
                  </span>
                </span>
                <TagFollowupsToggle tagId={tag.id} excludesFollowups={tag.excludes_followups} />
                <EditTagButton
                  tagId={tag.id}
                  tagName={tag.name}
                  tagColor={tag.color}
                  excludesFollowups={tag.excludes_followups}
                  marksPurchase={tag.marks_purchase}
                />
                <DeleteTagButton tagId={tag.id} tagName={tag.name} contactCount={contactCount} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
