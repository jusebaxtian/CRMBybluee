"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { resetContactAutomationHistory } from "@/app/actions/automations";

// Every automation trigger only ever runs once per contact — useful in
// production, but it means a test number can't retrigger a flow to verify
// a fix without a fresh contact each time. This wipes that contact's
// "already ran" history across every automation so the next matching
// message/tap starts everything fresh, as if they'd never triggered
// anything before.
export function ResetAutomationsButton({ contactId }: { contactId: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      "¿Reiniciar el historial de automatizaciones de este contacto?\n\nLa próxima vez que escriba o toque un botón, todas las automatizaciones podrán volver a activarse para él, como si nunca hubiera interactuado antes. Útil solo para pruebas."
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    const result = await resetContactAutomationHistory(contactId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title="Reiniciar historial de automatizaciones (solo para pruebas)"
        aria-label="Reiniciar historial de automatizaciones"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
          done ? "text-success" : "text-muted hover:bg-surface-hover hover:text-foreground"
        } disabled:opacity-50`}
      >
        <RotateCcw size={18} />
      </button>
      {error && (
        <p className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-2 text-xs text-red-400 shadow-xl">
          {error}
        </p>
      )}
    </div>
  );
}
