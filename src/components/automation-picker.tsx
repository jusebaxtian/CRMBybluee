"use client";

import { useState, useTransition } from "react";
import { Workflow, X } from "lucide-react";
import { runAutomationManually } from "@/app/actions/automations";

type Automation = { id: string; name: string };

export function AutomationPicker({
  contactId,
  automations,
}: {
  contactId: string;
  automations: Automation[];
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (automations.length === 0) return null;

  function handleRun(automationId: string) {
    setError(null);
    setPendingId(automationId);
    startTransition(async () => {
      const result = await runAutomationManually(automationId, contactId);
      setPendingId(null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      // RealtimeRefresh picks up any messages the automation sent automatically.
    });
  }

  return (
    <div className="relative">
      {open && (
        <div className="absolute left-full top-1/2 z-20 ml-2 w-64 -translate-y-1/2 rounded-xl border border-border bg-surface p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Automatizaciones
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {automations.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => handleRun(a.id)}
                disabled={pendingId !== null}
                className="rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
              >
                {pendingId === a.id ? "Ejecutando..." : a.name}
              </button>
            ))}
          </div>
          {error && <p className="mt-1 px-1 text-xs text-red-400">{error}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Enviar automatización"
        aria-label="Enviar automatización"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
          open
            ? "bg-primary text-white"
            : "text-muted hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <Workflow size={18} />
      </button>
    </div>
  );
}
