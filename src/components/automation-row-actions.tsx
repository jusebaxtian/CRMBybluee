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
}: {
  automationId: string;
  automationName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    await toggleAutomationActive(automationId, !isActive);
    setPending(false);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar la automatización "${automationName}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setPending(true);
    await deleteAutomation(automationId);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`rounded-full px-2.5 py-1 text-xs disabled:opacity-50 ${
          isActive
            ? "bg-success/15 text-success"
            : "bg-surface-hover text-muted"
        }`}
      >
        {isActive ? "Activa" : "Pausada"}
      </button>
      <Link
        href={`/dashboard/automations/${automationId}`}
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
