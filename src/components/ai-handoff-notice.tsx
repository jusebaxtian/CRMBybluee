"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { clearAiHandoff } from "@/app/actions/ai-agent";

export function AiHandoffNotice({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClear() {
    setPending(true);
    await clearAiHandoff(conversationId);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
        <Bot size={13} />
        La IA pidió ayuda humana
      </p>
      <p className="mt-1 text-xs text-muted">
        El cliente pidió hablar con una persona (o preguntó algo que la IA no pudo resolver). Se
        pausó automáticamente para este chat — respóndele tú, o reactívala cuando ya no haga falta.
      </p>
      <button
        type="button"
        onClick={handleClear}
        disabled={pending}
        className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-hover disabled:opacity-50"
      >
        {pending ? "Reactivando..." : "Reactivar IA en este chat"}
      </button>
    </div>
  );
}
