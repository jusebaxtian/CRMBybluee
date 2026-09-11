"use client";

import { useState, useTransition } from "react";
import { Zap, X } from "lucide-react";
import { sendQuickReply } from "@/app/actions/quick-replies";

type QuickReply = { id: string; name: string };

export function QuickReplyPicker({
  contactId,
  quickReplies,
}: {
  contactId: string;
  quickReplies: QuickReply[];
}) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (quickReplies.length === 0) return null;

  function handleSend(quickReplyId: string) {
    setError(null);
    setPendingId(quickReplyId);
    startTransition(async () => {
      const result = await sendQuickReply(quickReplyId, contactId);
      setPendingId(null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      // RealtimeRefresh picks up the sent message(s) automatically.
    });
  }

  return (
    <div className="relative">
      {open && (
        <div className="absolute left-full top-1/2 z-20 ml-2 w-64 -translate-y-1/2 rounded-xl border border-border bg-surface p-2 shadow-xl">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Respuestas rápidas
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
            {quickReplies.map((qr) => (
              <button
                key={qr.id}
                type="button"
                onClick={() => handleSend(qr.id)}
                disabled={pendingId !== null}
                className="rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
              >
                {pendingId === qr.id ? "Enviando..." : qr.name}
              </button>
            ))}
          </div>
          {error && <p className="mt-1 px-1 text-xs text-red-400">{error}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Respuestas rápidas"
        aria-label="Respuestas rápidas"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 ${
          open
            ? "bg-primary text-white"
            : "text-muted hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <Zap size={18} />
      </button>
    </div>
  );
}
