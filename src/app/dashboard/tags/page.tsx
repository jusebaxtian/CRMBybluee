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
        <div className="rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[20px_1fr_70px_auto_70px] items-center gap-3 border-b border-border px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-muted">
            <span />
            <span>Etiqueta</span>
            <span className="text-right">Contactos</span>
            <span>Configuración</span>
            <span />
          </div>
          {tags.map((tag) => {
            const contactCount = (tag.contact_tags as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <div
                key={tag.id}
                className="group grid grid-cols-[20px_1fr_70px_auto_70px] items-center gap-3 border-b border-border px-4 py-2 text-sm last:border-b-0 hover:bg-surface-hover"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="truncate text-foreground">{tag.name}</span>
                <span
                  className="text-right tabular-nums text-muted"
                  title={`${contactCount} contacto${contactCount === 1 ? "" : "s"} con esta etiqueta`}
                >
                  {contactCount}
                </span>
                <div className="flex items-center gap-1.5">
                  <TagFollowupsToggle tagId={tag.id} excludesFollowups={tag.excludes_followups} />
                  {tag.marks_purchase && (
                    <span
                      className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] text-success"
                      title="Reporta compra a Meta Ads (Conversions API) al usar esta etiqueta"
                    >
                      Reporta compra
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <EditTagButton
                    tagId={tag.id}
                    tagName={tag.name}
                    tagColor={tag.color}
                    excludesFollowups={tag.excludes_followups}
                    marksPurchase={tag.marks_purchase}
                  />
                  <DeleteTagButton tagId={tag.id} tagName={tag.name} contactCount={contactCount} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
