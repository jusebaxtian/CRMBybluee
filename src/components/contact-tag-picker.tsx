"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toggleContactTag } from "@/app/actions/tags";

type Tag = { id: string; name: string; color: string };

export function ContactTagPicker({
  contactId,
  allTags,
  assignedTagIds,
}: {
  contactId: string;
  allTags: Tag[];
  assignedTagIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const assigned = new Set(assignedTagIds);

  function handleToggle(tagId: string, isAssigned: boolean) {
    startTransition(() => {
      toggleContactTag({ contactId, tagId, assign: !isAssigned });
    });
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {allTags
        .filter((t) => assigned.has(t.id))
        .map((t) => (
          <span
            key={t.id}
            onClick={() => handleToggle(t.id, true)}
            className="cursor-pointer rounded-full border px-2 py-0.5 text-xs"
            style={{ color: t.color, borderColor: t.color }}
            title="Click para quitar"
          >
            {t.name}
          </span>
        ))}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted hover:text-foreground"
      >
        <Plus size={12} />
      </button>

      {open && (
        <div className="absolute top-6 left-0 z-10 flex w-48 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
          {allTags.length === 0 && (
            <p className="px-1 text-xs text-muted">No hay etiquetas creadas.</p>
          )}
          {allTags.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-surface-hover"
            >
              <input
                type="checkbox"
                checked={assigned.has(t.id)}
                onChange={() => handleToggle(t.id, assigned.has(t.id))}
              />
              <span style={{ color: t.color }}>{t.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
