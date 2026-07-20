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

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, wa_id, created_at, contact_tags(tag_id)")
    .eq("workspace_id", workspaceId ?? "")
    .order("created_at", { ascending: false });

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
            o impórtalos desde un CSV con columnas &quot;name&quot; y &quot;phone&quot;.
          </p>
        </div>
      </div>
    );
  }

  const rows = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    wa_id: c.wa_id,
    created_at: c.created_at,
    assignedTagIds: (c.contact_tags as unknown as { tag_id: string }[]).map((ct) => ct.tag_id),
  }));

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
