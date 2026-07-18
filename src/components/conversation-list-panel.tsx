"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NewMessageButton } from "@/components/new-message-button";

type Tag = { id: string; name: string; color: string };
type Conversation = {
  id: string;
  last_message_at: string;
  lastMessagePreview: string | null;
  answered: boolean;
  unreadCount: number;
  contact: { name: string | null; wa_id: string };
  tags: Tag[];
};
type Contact = { id: string; name: string | null; wa_id: string };

export function ConversationListPanel({
  conversations,
  contacts,
}: {
  conversations: Conversation[];
  contacts: Contact[];
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const filtered = conversations.filter((c) => c.contact.wa_id.includes(query));

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface lg:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Conversaciones</h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
            {conversations.length}
          </span>
        </div>
        <NewMessageButton contacts={contacts} compact />
      </div>

      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-transparent text-sm text-foreground outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">Sin resultados.</p>
        )}
        {filtered.map((conv) => {
          const active = pathname === `/dashboard/inbox/${conv.id}`;
          return (
            <Link
              key={conv.id}
              href={`/dashboard/inbox/${conv.id}`}
              className={`flex items-center gap-3 border-b border-border px-4 py-3 ${
                active ? "bg-surface-hover" : "hover:bg-surface-hover"
              }`}
            >
              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {conv.contact.wa_id.charAt(0).toUpperCase()}
                </div>
                {!conv.answered && (
                  <span
                    title="Sin responder"
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-warning"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {conv.contact.wa_id}
                    </p>
                    {conv.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag.id}
                        title={tag.name}
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                    ))}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted">
                    {new Date(conv.last_message_at).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted">
                    {conv.lastMessagePreview ?? "Sin mensajes"}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
