"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { resetContactBlockedStatus } from "@/app/actions/contacts";

export function ContactBlockedNotice({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleReset() {
    setPending(true);
    await resetContactBlockedStatus(contactId);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-red-400">
        <ShieldAlert size={13} />
        Posible bloqueo
      </p>
      <p className="mt-1 text-xs text-muted">
        Varios mensajes seguidos no se pudieron entregar a este número — es la señal más cercana
        a un bloqueo que WhatsApp comparte. No recibe seguimientos ni mensajes masivos hasta que
        vuelva a responder o lo restablezcas manualmente.
      </p>
      <button
        type="button"
        onClick={handleReset}
        disabled={pending}
        className="mt-2 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-hover disabled:opacity-50"
      >
        {pending ? "Restableciendo..." : "Restablecer (sé que el número está bien)"}
      </button>
    </div>
  );
}
