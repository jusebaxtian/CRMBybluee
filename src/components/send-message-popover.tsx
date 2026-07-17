"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { sendMessageToContact } from "@/app/actions/whatsapp";

export function SendMessagePopover({
  contactId,
  label = "Mensaje",
}: {
  contactId: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const result = await sendMessageToContact({ contactId, body });
    setPending(false);

    if ("error" in result) {
      setError(result.error ?? "Ocurrió un error.");
      return;
    }

    setOpen(false);
    setBody("");
    router.push(`/dashboard/inbox/${result.conversationId}`);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-hover"
      >
        <MessageCircle size={12} />
        {label}
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Enviar mensaje</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Escribe tu mensaje..."
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleSend}
            disabled={pending}
            className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
