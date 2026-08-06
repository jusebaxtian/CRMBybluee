"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { setAiManuallyPaused } from "@/app/actions/ai-agent";

export function ConversationAiToggle({
  conversationId,
  manuallyPaused,
}: {
  conversationId: string;
  manuallyPaused: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    await setAiManuallyPaused(conversationId, !manuallyPaused);
    setPending(false);
    router.refresh();
  }

  const enabled = !manuallyPaused;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Bot size={13} className="text-muted" />
        IA en este chat
      </span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={enabled}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
          enabled ? "border-primary bg-primary" : "border-border bg-surface-hover"
        }`}
        title={enabled ? "Pausar la IA en este chat para atenderlo tú" : "Reactivar la IA en este chat"}
      >
        <span
          className={`absolute left-1 top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
