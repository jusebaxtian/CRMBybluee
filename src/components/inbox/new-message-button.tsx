"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SquarePen, X } from "lucide-react";
import { sendMessageToContact } from "@/app/actions/whatsapp";

type Contact = { id: string; name: string | null; wa_id: string };

export function NewMessageButton({
  contacts,
  compact = false,
}: {
  contacts: Contact[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!contactId || !body.trim()) return;
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
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={contacts.length === 0}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          title={contacts.length === 0 ? "No tienes contactos todavía" : "Nuevo mensaje"}
        >
          <SquarePen size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={contacts.length === 0}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          title={contacts.length === 0 ? "No tienes contactos todavía" : undefined}
        >
          <Plus size={14} />
          Nuevo mensaje
        </button>
      )}

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Nuevo mensaje</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
              <X size={16} />
            </button>
          </div>

          <label htmlFor="contact" className="mb-1 block text-xs font-medium text-muted">
            Contacto
          </label>
          <select
            id="contact"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.wa_id} ({c.wa_id})
              </option>
            ))}
          </select>

          <label htmlFor="body" className="mb-1 block text-xs font-medium text-muted">
            Mensaje
          </label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleSend}
            disabled={pending}
            className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
