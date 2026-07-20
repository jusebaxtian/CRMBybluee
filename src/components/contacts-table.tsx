"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Tag as TagIcon, X, Check } from "lucide-react";
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

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
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

  async function handleBulkDelete() {
    const confirmed = window.confirm(
      `¿Eliminar ${selected.size} contacto(s) seleccionado(s)? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setPending(true);
    setError(null);
    const result = await bulkDeleteContacts(Array.from(selected));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSelected(new Set());
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
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>

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
            onClick={handleBulkDelete}
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
            {contacts.map((c) => (
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
                    <td className="px-5 py-3 text-foreground">{c.name ?? "—"}</td>
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
    </div>
  );
}
