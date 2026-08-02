"use client";

import { useMessageWindow } from "@/lib/use-message-window";

export function ConversationWindowStatus({ lastInboundAt }: { lastInboundAt: string | null }) {
  const { open, msRemaining, expiresAt } = useMessageWindow(lastInboundAt);

  if (!lastInboundAt) {
    return (
      <p className="truncate text-xs text-muted">Cliente aún no ha escrito — solo plantillas</p>
    );
  }

  if (!open) {
    return (
      <p className="truncate text-xs text-red-400">
        Ventana de 24h vencida — solo puedes enviar plantillas
      </p>
    );
  }

  const h = Math.floor(msRemaining / 3_600_000);
  const m = Math.floor((msRemaining % 3_600_000) / 60_000);
  const s = Math.floor((msRemaining % 60_000) / 1_000);
  const expiresLabel = expiresAt?.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <p className="truncate text-xs text-success">
      Ventana de 24h: {h}h {m}m {s}s · vence {expiresLabel}
    </p>
  );
}
