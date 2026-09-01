import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ImportContactsButton } from "@/components/import-contacts-button";
import { AddContactForm } from "@/components/add-contact-form";
import { ContactsTable } from "@/components/contacts-table";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

export default async function ContactsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "contacts");

  // PostgREST caps any single request at 1000 rows (PGRST_DB_MAX_ROWS) —
  // a plain .select() on a workspace with more contacts than that silently
  // truncates instead of erroring, so "Total de contactos" undercounted for
  // any workspace past 1000. Page through in batches of 1000 until exhausted.
  const contacts: {
    id: string;
    name: string | null;
    wa_id: string;
    created_at: string;
    contact_tags: { tag_id: string }[];
    conversations: { ad_source_id: string | null; ad_headline: string | null }[];
  }[] = [];
  if (workspaceId) {
    const PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: batch } = await supabase
        .from("contacts")
        .select("id, name, wa_id, created_at, contact_tags(tag_id), conversations(ad_source_id, ad_headline)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (!batch || batch.length === 0) break;
      contacts.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  }

  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  if (!contacts || contacts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <AddContactForm />
          <ImportContactsButton />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <Users size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Todavía no tienes contactos
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Los contactos se crean automáticamente cuando alguien te escribe por WhatsApp,
            o impórtalos desde un archivo Excel — descarga la plantilla arriba para ver el formato exacto.
          </p>
        </div>
      </div>
    );
  }

  const rows = contacts.map((c) => {
    const conversation = (
      c.conversations as unknown as { ad_source_id: string | null; ad_headline: string | null }[]
    )[0];
    return {
      id: c.id,
      name: c.name,
      wa_id: c.wa_id,
      created_at: c.created_at,
      assignedTagIds: (c.contact_tags as unknown as { tag_id: string }[]).map((ct) => ct.tag_id),
      fromAds: !!conversation?.ad_source_id,
      adHeadline: conversation?.ad_headline ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AddContactForm />
        <ImportContactsButton />
      </div>
      <ContactsTable contacts={rows} allTags={allTags ?? []} />
    </div>
  );
}
