"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateContactNotes } from "@/app/actions/contacts";

export function NotesEditor({
  contactId,
  initialNotes,
}: {
  contactId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    await updateContactNotes(contactId, notes);
    setPending(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          autoFocus
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer rounded-lg border border-border bg-background p-3 text-sm text-foreground hover:border-primary"
    >
      {notes || <span className="text-muted">Agregar una nota...</span>}
    </div>
  );
}
