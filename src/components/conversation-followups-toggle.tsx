"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    await setConversationFollowupsEnabled(conversationId, !enabled);
    setPending(false);
    router.refresh();
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
          disabled={pending}
          aria-pressed={enabled}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
            enabled ? "border-primary bg-primary" : "border-border bg-surface-hover"
          }`}
          title={enabled ? "Desactivar seguimientos para este contacto" : "Activar seguimientos para este contacto"}
        >
          <span
            className={`absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-1"
            }`}
          />
        </button>
      )}
    </div>
  );
}
