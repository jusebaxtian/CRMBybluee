"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toggleAutomationActive, deleteAutomation } from "@/app/actions/automations";

export function AutomationRowActions({
  automationId,
  isActive,
}: {
  automationId: string;
  isActive: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={async () => {
          await toggleAutomationActive(automationId, !isActive);
          router.refresh();
        }}
        className={`rounded-full px-2.5 py-1 text-xs ${
          isActive
            ? "bg-success/15 text-success"
            : "bg-surface-hover text-muted"
        }`}
      >
        {isActive ? "Activa" : "Pausada"}
      </button>
      <button
        type="button"
        onClick={async () => {
          await deleteAutomation(automationId);
          router.refresh();
        }}
        className="text-muted hover:text-red-400"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
