"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X, Clock } from "lucide-react";
import { NewMessageButton } from "@/components/new-message-button";
import { useMessageWindow } from "@/lib/use-message-window";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_MAX_MS = 2 * 60 * 60 * 1000; // 2h
const EXPIRING_SOON_MIN_MS = 10 * 1000; // 10s

function msRemaining(lastInboundAt: string, now: number) {
  return new Date(lastInboundAt).getTime() + WINDOW_MS - now;
}

type Tag = { id: string; name: string; color: string };
type Agent = { id: string; name: string | null; email: string };
type Conversation = {
  id: string;
  last_message_at: string;
  lastMessagePreview: string | null;
  answered: boolean;
  unreadCount: number;
  assignedAgentId: string | null;
  lastInboundAt: string | null;
  contact: { name: string | null; wa_id: string };
  tags: Tag[];
};

// Small red "24h" flag next to the timestamp when the WhatsApp free-form
// window has expired for that contact — same rule as the chat's own gate.
function WindowExpiredBadge({ lastInboundAt }: { lastInboundAt: string | null }) {
  const { open } = useMessageWindow(lastInboundAt);
  if (!lastInboundAt || open) return null;
  return (
    <span
      title="Ventana de 24h vencida — solo se pueden enviar plantillas"
      className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold text-red-400"
    >
      24h
    </span>
  );
}
// Orange flag when the window is about to close (between 10s and 2h left)
// — an agent still has time to send a quick follow-up before it locks.
function WindowExpiringSoonBadge({
  lastInboundAt,
  now,
}: {
  lastInboundAt: string | null;
  now: number;
}) {
  if (!lastInboundAt) return null;
  const remaining = msRemaining(lastInboundAt, now);
  if (remaining < EXPIRING_SOON_MIN_MS || remaining > EXPIRING_SOON_MAX_MS) return null;
  const m = Math.floor(remaining / 60_000);
  return (
    <span
      title="La ventana de 24h está por vencer"
      className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold text-warning"
    >
      <Clock size={10} />
      {m}m
    </span>
  );
}

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
  const [expiringSoon, setExpiringSoon] = useState(false);

  // Only needed to keep the "por vencer" filter and its badges live —
  // ticks once a second so a conversation drops out of the list the moment
  // it crosses the 2h or 10s edge, without a manual refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (query && !c.contact.wa_id.includes(query)) return false;
      if (unreadOnly && c.unreadCount === 0) return false;
      if (expiringSoon) {
        if (!c.lastInboundAt) return false;
        const remaining = msRemaining(c.lastInboundAt, now);
        if (remaining < EXPIRING_SOON_MIN_MS || remaining > EXPIRING_SOON_MAX_MS) return false;
      }
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
  }, [conversations, query, unreadOnly, expiringSoon, now, selectedTagIds, assignedFilter]);

  const activeFilterCount =
    selectedTagIds.length + (assignedFilter ? 1 : 0) + (unreadOnly ? 1 : 0) + (expiringSoon ? 1 : 0);

  // Total chats with unread messages — independent of the active filters,
  // so this badge always reflects "how many I haven't opened yet".
  const unreadConversationsCount = useMemo(
    () => conversations.filter((c) => c.unreadCount > 0).length,
    [conversations]
  );

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function clearFilters() {
    setSelectedTagIds([]);
    setAssignedFilter("");
    setUnreadOnly(false);
    setExpiringSoon(false);
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface lg:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Conversaciones</h2>
          {unreadConversationsCount > 0 && (
            <span
              title="Chats sin abrir"
              className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary"
            >
              {unreadConversationsCount}
            </span>
          )}
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
          <div className="flex flex-wrap gap-2">
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
            <button
              type="button"
              onClick={() => setExpiringSoon((v) => !v)}
              title="Ventana de 24h por vencer (entre 10 segundos y 2 horas)"
              className={`flex items-center gap-1 self-start rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                expiringSoon
                  ? "border-warning bg-warning text-black"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              <Clock size={12} />
              Por vencer (2h)
            </button>
          </div>

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
                  <p className="truncate text-sm font-medium text-foreground">
                    {conv.contact.wa_id}
                  </p>
                  <span className="flex shrink-0 items-center gap-1">
                    <WindowExpiredBadge lastInboundAt={conv.lastInboundAt} />
                    <WindowExpiringSoonBadge lastInboundAt={conv.lastInboundAt} now={now} />
                    <span className="text-[10px] text-muted">
                      {new Date(conv.last_message_at).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
                {conv.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {conv.tags.map((tag) => (
                      <span
                        key={tag.id}
                        title={tag.name}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
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
