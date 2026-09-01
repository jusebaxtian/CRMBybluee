"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Tag as TagIcon,
  X,
  Check,
  Megaphone,
  Search,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import { ContactTagPicker } from "@/components/contact-tag-picker";
import { SendMessagePopover } from "@/components/send-message-popover";
import { updateContact, bulkDeleteContacts, bulkAddTagToContacts } from "@/app/actions/contacts";

type Tag = { id: string; name: string; color: string };
type Contact = {
  id: string;
  name: string | null;
  wa_id: string;
  created_at: string;
  assignedTagIds: string[];
  fromAds: boolean;
  adHeadline: string | null;
};

export function ContactsTable({
  contacts,
  allTags,
}: {
  contacts: Contact[];
  allTags: Tag[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    // Only treat the query as a phone search when it's actually phone-shaped
    // (digits plus common punctuation like "+57 300 123") — otherwise a name
    // like "Carlos1" would have its lone digit match almost any number.
    const cleanedForPhone = search.trim().replace(/[\s()+-]/g, "");
    const isPhoneQuery = cleanedForPhone.length > 0 && /^\d+$/.test(cleanedForPhone);

    return contacts.filter((c) => {
      if (query) {
        const matchesName = c.name?.toLowerCase().includes(query);
        const matchesNumber = isPhoneQuery && c.wa_id.includes(cleanedForPhone);
        if (!matchesName && !matchesNumber) return false;
      }
      if (tagFilter && !c.assignedTagIds.includes(tagFilter)) return false;
      if (dateFrom && c.created_at < dateFrom) return false;
      if (dateTo && c.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [contacts, search, tagFilter, dateFrom, dateTo]);

  const activeFilterCount = (tagFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  function clearFilters() {
    setTagFilter("");
    setDateFrom("");
    setDateTo("");
  }

  // The full contact list can now legitimately be thousands of rows (fixed
  // the fetch that was silently capping it at 1000) — paginate the render
  // so the browser isn't drawing all of them into the DOM at once. Filtering
  // above still runs over the complete in-memory list, so search/filters
  // still reach every contact, not just the current page.
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const pagedContacts = useMemo(
    () => filteredContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredContacts, page]
  );

  useEffect(() => {
    setPage(1);
  }, [search, tagFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const MAX_BULK_DELETE = 1000;
  const DELETE_BATCH_SIZE = 100;
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);

  const allSelected =
    filteredContacts.length > 0 &&
    selected.size === Math.min(filteredContacts.length, MAX_BULK_DELETE);
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    // Cap at MAX_BULK_DELETE even when "seleccionar todos" would match more —
    // keeps every selection a size the bulk-delete action will actually accept.
    setSelected(new Set(filteredContacts.slice(0, MAX_BULK_DELETE).map((c) => c.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setEditName(c.name ?? "");
    setEditPhone(c.wa_id);
    setError(null);
  }

  async function saveEdit(contactId: string) {
    setPending(true);
    setError(null);
    const result = await updateContact(contactId, editName, editPhone);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function confirmBulkDelete() {
    setPending(true);
    setError(null);
    const ids = Array.from(selected);
    const total = ids.length;
    setDeleteProgress({ done: 0, total });

    // One request per 100 instead of all at once — gives a real % instead of
    // a spinner, and keeps each delete (with its cascade to
    // conversations/messages) short instead of one long transaction.
    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
      const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
      const result = await bulkDeleteContacts(batch);
      if (result?.error) {
        setError(result.error);
        setPending(false);
        setDeleteProgress(null);
        return;
      }
      setDeleteProgress({ done: Math.min(i + DELETE_BATCH_SIZE, total), total });
    }

    setPending(false);
    setDeleteProgress(null);
    setSelected(new Set());
    setDeleteModalOpen(false);
    setDeleteConfirmText("");
    router.refresh();
  }

  async function handleBulkTag(tagId: string) {
    setPending(true);
    setError(null);
    const result = await bulkAddTagToContacts(Array.from(selected), tagId);
    setPending(false);
    setTagMenuOpen(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o número..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
              activeFilterCount > 0
                ? "border-primary text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {filtersOpen && (
            <div className="absolute right-0 top-10 z-20 flex w-64 flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Etiqueta</label>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">Todas</option>
                  {allTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Creado desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Creado hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="self-start text-xs text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-muted">
        <span className="text-base font-semibold text-foreground">{filteredContacts.length}</span>{" "}
        contacto{filteredContacts.length === 1 ? "" : "s"}
        {(search || activeFilterCount > 0) && <span> de {contacts.length} en total</span>}
      </p>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <span className="text-xs text-muted">(máximo {MAX_BULK_DELETE} a la vez)</span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setTagMenuOpen((o) => !o)}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
            >
              <TagIcon size={13} />
              Agregar etiqueta
            </button>
            {tagMenuOpen && (
              <div className="absolute top-8 left-0 z-10 flex w-48 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
                {allTags.length === 0 && (
                  <p className="px-1 py-1 text-xs text-muted">No hay etiquetas creadas.</p>
                )}
                {allTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleBulkTag(t.id)}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-hover"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <span style={{ color: t.color }}>{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (selected.size !== 1) return;
              const contact = contacts.find((c) => selected.has(c.id));
              if (contact) startEdit(contact);
            }}
            disabled={pending || selected.size !== 1}
            title={selected.size !== 1 ? "Selecciona solo un contacto para editar" : "Editar"}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            <Pencil size={13} />
            Editar
          </button>

          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-md border border-red-400 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 size={13} />
            Eliminar
          </button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted hover:text-foreground"
          >
            Cancelar selección
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="overflow-visible rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="w-10 px-5 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Número</th>
              <th className="px-5 py-3 font-medium">Etiquetas</th>
              <th className="px-5 py-3 font-medium">Contacto desde</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-muted">
                  Sin resultados para estos filtros.
                </td>
              </tr>
            )}
            {pagedContacts.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                  />
                </td>
                {editingId === c.id ? (
                  <>
                    <td className="px-5 py-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre"
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="Número"
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-5 py-3" colSpan={2} />
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(c.id)}
                          disabled={pending}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white disabled:opacity-50"
                          title="Guardar"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted hover:text-foreground"
                          title="Cancelar"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 text-foreground">
                      <span className="flex items-center gap-1.5">
                        {c.name ?? "—"}
                        {c.fromAds && (
                          <span
                            title={
                              c.adHeadline
                                ? `Llegó desde un anuncio de Meta Ads: ${c.adHeadline}`
                                : "Llegó desde un anuncio de Meta Ads"
                            }
                          >
                            <Megaphone size={12} className="shrink-0 text-primary" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-foreground">{c.wa_id}</td>
                    <td className="px-5 py-3">
                      <ContactTagPicker
                        contactId={c.id}
                        allTags={allTags}
                        assignedTagIds={c.assignedTagIds}
                      />
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {new Date(c.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <SendMessagePopover contactId={c.id} />
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredContacts.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredContacts.length)} de{" "}
            {filteredContacts.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-muted">
              Página {page} de {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={18} />
              <h3 className="text-base font-semibold">Eliminar contactos</h3>
            </div>
            <p className="mt-3 text-sm text-muted">
              Vas a eliminar{" "}
              <span className="font-semibold text-foreground">{selected.size}</span> contacto
              {selected.size === 1 ? "" : "s"} de forma permanente, junto con su conversación e
              historial de mensajes. Esta acción no se puede deshacer.
            </p>
            <p className="mt-2 text-xs text-muted">
              Puedes eliminar máximo <span className="font-semibold text-foreground">1000 contactos</span>{" "}
              a la vez.
            </p>

            {deleteProgress ? (
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted">Eliminando...</span>
                  <span className="font-semibold text-foreground">
                    {Math.round((deleteProgress.done / deleteProgress.total) * 100)}% ({deleteProgress.done}/
                    {deleteProgress.total})
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${(deleteProgress.done / deleteProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs text-muted">
                  Escribe <span className="font-mono font-semibold text-foreground">ELIMINAR</span> para
                  confirmar.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="ELIMINAR"
                  autoFocus
                  className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-red-400"
                />
              </>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmText("");
                }}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={pending || deleteConfirmText.trim().toUpperCase() !== "ELIMINAR"}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending
                  ? deleteProgress
                    ? `Eliminando... ${Math.round((deleteProgress.done / deleteProgress.total) * 100)}%`
                    : "Eliminando..."
                  : `Eliminar ${selected.size} contacto(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
