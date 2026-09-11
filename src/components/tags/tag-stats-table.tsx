"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { GripVertical, Tag as TagIcon } from "lucide-react";
import { reorderTags } from "@/app/actions/tags";

type TagRow = { id: string; name: string; color: string; count: number };

export function TagStatsTable({
  tags,
  totalContacts,
  dateFrom,
  dateTo,
}: {
  tags: TagRow[];
  totalContacts: number;
  dateFrom: string | null;
  dateTo: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState(tags);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState(dateFrom ?? "");
  const [to, setTo] = useState(dateTo ?? "");
  const [isPending, startTransition] = useTransition();

  // The date filter re-fetches server-side (new counts) and re-renders this
  // component with a new `tags` prop — keep local drag state in sync with
  // whatever the server just sent instead of freezing on the first render.
  useEffect(() => {
    setRows(tags);
  }, [tags]);

  function applyDateFilter(nextFrom: string, nextTo: string) {
    const qs = new URLSearchParams(searchParams.toString());
    if (nextFrom) qs.set("tagsFrom", nextFrom);
    else qs.delete("tagsFrom");
    if (nextTo) qs.set("tagsTo", nextTo);
    else qs.delete("tagsTo");
    // scroll: false + a transition — this only refetches this table's data,
    // no reason to jump the page back to the top or block the UI while it does.
    startTransition(() => {
      router.push(`${pathname}${qs.toString() ? `?${qs.toString()}` : ""}`, { scroll: false });
    });
  }

  function applyPreset(daysBack: number | "month") {
    const toDate = new Date();
    const fromDate =
      daysBack === "month" ? new Date(toDate.getFullYear(), toDate.getMonth(), 1) : new Date(toDate);
    if (daysBack !== "month") fromDate.setDate(fromDate.getDate() - daysBack);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setFrom(fmt(fromDate));
    setTo(fmt(toDate));
    applyDateFilter(fmt(fromDate), fmt(toDate));
  }

  function clearDates() {
    setFrom("");
    setTo("");
    applyDateFilter("", "");
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setRows((prev) => {
      const fromIdx = prev.findIndex((r) => r.id === dragId);
      const toIdx = prev.findIndex((r) => r.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setSaving(true);
      reorderTags(next.map((r) => r.id)).finally(() => setSaving(false));
      return next;
    });
    setDragId(null);
  }

  const hasDateFilter = !!(from || to);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TagIcon size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Etiquetas</h2>
        </div>
        <span className="text-xs text-muted">
          {saving ? "Guardando orden..." : isPending ? "Actualizando..." : "Arrastra para reordenar"}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted">
        Cuántos contactos tiene cada etiqueta, sobre el total de {totalContacts.toLocaleString("es-CO")}{" "}
        contactos{hasDateFilter ? " en el rango elegido" : ""}.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-background p-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              applyDateFilter(e.target.value, to);
            }}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              applyDateFilter(from, e.target.value);
            }}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset(6)}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-primary"
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            onClick={() => applyPreset("month")}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-primary"
          >
            Este mes
          </button>
          {hasDateFilter && (
            <button
              type="button"
              onClick={clearDates}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {hasDateFilter ? "Ninguna etiqueta tiene contactos en ese rango." : "Todavía no tienes etiquetas creadas."}
        </p>
      ) : (
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
      )}
      </div>
    </div>
  );
}
