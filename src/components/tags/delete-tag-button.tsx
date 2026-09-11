"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteTag } from "@/app/actions/tags";

export function DeleteTagButton({
  tagId,
  tagName,
  contactCount,
}: {
  tagId: string;
  tagName: string;
  contactCount: number;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const contactsNote =
      contactCount > 0
        ? ` Está asignada a ${contactCount} contacto${contactCount === 1 ? "" : "s"} — se les quitará la etiqueta.`
        : "";
    const firstConfirm = window.confirm(`¿Eliminar la etiqueta "${tagName}"?${contactsNote}`);
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      `Esta acción no se puede deshacer. Confirma de nuevo para eliminar "${tagName}" definitivamente.`
    );
    if (!secondConfirm) return;

    setPending(true);
    await deleteTag(tagId);
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-muted hover:text-red-400 disabled:opacity-50"
      title="Eliminar etiqueta"
    >
      <Trash2 size={14} />
    </button>
  );
}
