"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { NewMessageButton } from "@/components/new-message-button";

type Tag = { id: string; name: string; color: string };
type Agent = { id: string; name: string | null; email: string };
type Conversation = {
  id: string;
  last_message_at: string;
  lastMessagePreview: string | null;
  answered: boolean;
  unreadCount: number;
  assignedAgentId: string | null;
  contact: { name: string | null; wa_id: string };
  tags: Tag[];
};
type Contact = { id: string; name: string | null; wa_id: string };

export function ConversationListPanel({
  conversations,
  contacts,
  allTags,
  agents,
}: {
  conversations: Conversation[];
  contacts: Contact[];
  allTags: Tag[];
  agents: Agent[];
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string>(""); // "" = all, "unassigned", or agent id
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (query && !c.contact.wa_id.includes(query)) return false;
      if (unreadOnly && c.unreadCount === 0) return false;
      if (
        selectedTagIds.length > 0 &&
        !c.tags.some((t) => selectedTagIds.includes(t.id))
      )
        return false;
      if (assignedFilter === "unassigned" && c.assignedAgentId) return false;
      if (
        assignedFilter &&
        assignedFilter !== "unassigned" &&
        c.assignedAgentId !== assignedFilter
      )
        return false;
      return true;
    });
  }, [conversations, query, unreadOnly, selectedTagIds, assignedFilter]);

  const activeFilterCount =
    selectedTagIds.length + (assignedFilter ? 1 : 0) + (unreadOnly ? 1 : 0);

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function clearFilters() {
    setSelectedTagIds([]);
    setAssignedFilter("");
    setUnreadOnly(false);
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface lg:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Conversaciones</h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
            {filtered.length}
          </span>
        </div>
        <NewMessageButton contacts={contacts} compact />
      </div>

      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-transparent text-sm text-foreground outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
            filtersOpen || activeFilterCount > 0
              ? "border-primary text-primary"
              : "border-border text-muted hover:text-foreground"
          }`}
          title="Filtros"
        >
          <SlidersHorizontal size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="flex flex-col gap-3 border-b border-border bg-background/50 p-3">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`self-start rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              unreadOnly
                ? "border-primary bg-primary text-white"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            No leídos
          </button>

          {allTags.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-transparent text-white"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                      style={active ? { backgroundColor: tag.color } : undefined}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: active ? "#fff" : tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {agents.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Asignado a
              </p>
              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                <option value="unassigned">Sin asignar</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 self-start text-xs text-muted hover:text-foreground"
            >
              <X size={12} />
              Limpiar filtros
            </button>
          )}
        </div>
      )}

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
