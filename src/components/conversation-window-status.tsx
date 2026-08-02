"use client";

import { useMessageWindow } from "@/lib/use-message-window";

export function ConversationWindowStatus({ lastInboundAt }: { lastInboundAt: string | null }) {
  const { open, expiresAt } = useMessageWindow(lastInboundAt);

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

  const expiresLabel = expiresAt?.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return <p className="truncate text-xs text-success">Vence {expiresLabel}</p>;
}
