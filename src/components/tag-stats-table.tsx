"use client";

import { useState } from "react";
import { GripVertical, Tag as TagIcon } from "lucide-react";
import { reorderTags } from "@/app/actions/tags";

type TagRow = { id: string; name: string; color: string; count: number };

export function TagStatsTable({
  tags,
  totalContacts,
}: {
  tags: TagRow[];
  totalContacts: number;
}) {
  const [rows, setRows] = useState(tags);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setSaving(true);
      reorderTags(next.map((r) => r.id)).finally(() => setSaving(false));
      return next;
    });
    setDragId(null);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-2 flex items-center gap-2">
          <TagIcon size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Etiquetas</h2>
        </div>
        <p className="text-sm text-muted">Todavía no tienes etiquetas creadas.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Etiquetas</h2>
        </div>
        <span className="text-xs text-muted">{saving ? "Guardando orden..." : "Arrastra para reordenar"}</span>
      </div>
      <p className="mb-4 text-xs text-muted">
        Cuántos contactos tiene cada etiqueta, sobre el total de {totalContacts.toLocaleString("es-CO")}{" "}
        contactos.
      </p>

      <div className="flex flex-col">
        <div className="grid grid-cols-[24px_1fr_90px_140px] gap-3 border-b border-border px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
          <span />
          <span>Etiqueta</span>
          <span className="text-right">Personas</span>
          <span className="text-right">% del total</span>
        </div>

        {rows.map((tag) => {
          const pct = totalContacts > 0 ? (tag.count / totalContacts) * 100 : 0;
          return (
            <div
              key={tag.id}
              draggable
              onDragStart={() => setDragId(tag.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(tag.id)}
              className={`grid grid-cols-[24px_1fr_90px_140px] items-center gap-3 border-b border-border px-2 py-2.5 last:border-b-0 ${
                dragId === tag.id ? "opacity-40" : ""
              }`}
            >
              <span className="cursor-grab text-muted active:cursor-grabbing" title="Arrastrar para reordenar">
                <GripVertical size={15} />
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="truncate text-sm text-foreground">{tag.name}</span>
              </span>
              <span className="text-right text-sm tabular-nums text-foreground">{tag.count}</span>
              <span className="flex items-center justify-end gap-2">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-hover">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: tag.color }}
                  />
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-muted">{pct.toFixed(1)}%</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
