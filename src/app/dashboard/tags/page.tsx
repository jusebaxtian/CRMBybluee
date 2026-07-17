import { Tag as TagIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateTagForm } from "@/components/create-tag-form";
import { DeleteTagButton } from "@/components/delete-tag-button";

export default async function TagsPage() {
  const supabase = await createClient();

  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, color")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
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
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm"
              style={{ color: tag.color, borderColor: tag.color }}
            >
              {tag.name}
              <DeleteTagButton tagId={tag.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
