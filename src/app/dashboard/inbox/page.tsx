import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function InboxPage() {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, last_message_at, status, contacts(name, wa_id)")
    .order("last_message_at", { ascending: false });

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
          <MessageSquare size={22} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Todavía no tienes conversaciones
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted">
          En cuanto un contacto te escriba por WhatsApp, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {conversations.map((conv) => {
        const contact = conv.contacts as unknown as { name: string | null; wa_id: string };
        return (
          <Link
            key={conv.id}
            href={`/dashboard/inbox/${conv.id}`}
            className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-surface-hover"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {(contact.name ?? contact.wa_id).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {contact.name ?? contact.wa_id}
                </p>
                <p className="text-xs text-muted">{contact.wa_id}</p>
              </div>
            </div>
            <p className="text-xs text-muted">
              {new Date(conv.last_message_at).toLocaleString("es-CO", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
