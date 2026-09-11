"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toggleAutomationActive, deleteAutomation } from "@/app/actions/automations";

export function AutomationRowActions({
  automationId,
  automationName,
  isActive,
  editHref,
  itemLabel = "la automatización",
  onToggle,
  onDelete,
  lockedByAi = false,
}: {
  automationId: string;
  automationName: string;
  isActive: boolean;
  editHref?: string;
  itemLabel?: string;
  onToggle?: (id: string, active: boolean) => Promise<unknown>;
  onDelete?: (id: string) => Promise<unknown>;
  lockedByAi?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (lockedByAi && !isActive) return;
    setPending(true);
    setError(null);
    const result = await (onToggle ?? toggleAutomationActive)(automationId, !isActive);
    if (result && typeof result === "object" && "error" in result && result.error) {
      setError(String(result.error));
    }
    setPending(false);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar ${itemLabel} "${automationName}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setPending(true);
    await (onDelete ?? deleteAutomation)(automationId);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end">
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending || (lockedByAi && !isActive)}
          title={
            lockedByAi && !isActive
              ? "Apaga el agente de IA para poder activar automatizaciones"
              : undefined
          }
          className={`rounded-full px-2.5 py-1 text-xs disabled:opacity-50 ${
            isActive
              ? "bg-success/15 text-success"
              : "bg-surface-hover text-muted"
          }`}
        >
          {isActive ? "Activa" : lockedByAi ? "Bloqueada (IA activa)" : "Pausada"}
        </button>
        {error && <p className="mt-1 max-w-40 text-right text-[10px] text-red-400">{error}</p>}
      </div>
      <Link
        href={editHref ?? `/dashboard/automations/${automationId}`}
        className="text-muted hover:text-foreground"
        title="Editar"
      >
        <Pencil size={14} />
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-muted hover:text-red-400 disabled:opacity-50"
        title="Eliminar"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
