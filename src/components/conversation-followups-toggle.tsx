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
    <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs text-foreground">
        <History size={13} className="text-muted" />
        Seguimientos
      </span>
      {excludedByTag ? (
        <span className="text-[11px] text-muted" title="Este contacto tiene una etiqueta que lo excluye de todos los seguimientos">
          Excluido por etiqueta
        </span>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-primary" : "bg-surface-hover"
          }`}
          title={enabled ? "Desactivar seguimientos para este contacto" : "Activar seguimientos para este contacto"}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      )}
    </div>
  );
}
