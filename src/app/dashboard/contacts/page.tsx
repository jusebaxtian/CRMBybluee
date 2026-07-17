import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContactTagPicker } from "@/components/contact-tag-picker";
import { ImportContactsButton } from "@/components/import-contacts-button";

export default async function ContactsPage() {
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, wa_id, created_at, contact_tags(tag_id)")
    .order("created_at", { ascending: false });

  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, color")
    .order("name");

  if (!contacts || contacts.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <ImportContactsButton />
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

  return (
    <div className="flex flex-col gap-4">
      <ImportContactsButton />
      <div className="overflow-visible rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Número</th>
              <th className="px-5 py-3 font-medium">Etiquetas</th>
              <th className="px-5 py-3 font-medium">Contacto desde</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const assignedTagIds = (
                c.contact_tags as unknown as { tag_id: string }[]
              ).map((ct) => ct.tag_id);
              return (
                <tr key={c.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3 text-foreground">{c.name ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{c.wa_id}</td>
                  <td className="px-5 py-3">
                    <ContactTagPicker
                      contactId={c.id}
                      allTags={allTags ?? []}
                      assignedTagIds={assignedTagIds}
                    />
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(c.created_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
