"use client";

import { useOptimistic, useTransition } from "react";
import { History } from "lucide-react";
import { setConversationFollowupsEnabled } from "@/app/actions/followups";

export function ConversationFollowupsToggle({
  conversationId,
  enabled,
  excludedByTag,
}: {
  conversationId: string;
  enabled: boolean;
  excludedByTag: boolean;
}) {
  // Ver la nota en conversation-ai-toggle: el interruptor responde al instante
  // y el valor real llega con la revalidacion de la accion.
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(enabled);
  const [, startTransition] = useTransition();

  function handleToggle() {
    const next = !optimisticEnabled;
    startTransition(async () => {
      setOptimisticEnabled(next);
      await setConversationFollowupsEnabled(conversationId, next);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <History size={13} className="text-muted" />
        Seguimientos
      </span>
      {excludedByTag ? (
        <span
          className="rounded-full bg-surface-hover px-2 py-1 text-[11px] text-muted"
          title="Este contacto tiene una etiqueta que lo excluye de todos los seguimientos"
        >
          Excluido por etiqueta
        </span>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={optimisticEnabled}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
            optimisticEnabled ? "border-primary bg-primary" : "border-border bg-surface-hover"
          }`}
          title={
            optimisticEnabled
              ? "Desactivar seguimientos para este contacto"
              : "Activar seguimientos para este contacto"
          }
        >
          <span
            className={`absolute left-1 top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${
              optimisticEnabled ? "translate-x-[18px]" : "translate-x-0"
            }`}
          />
        </button>
      )}
    </div>
  );
}
