"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Enlace de registro con pago: un toque lo copia. */
export function EnlaceInvitacion({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title="Toca para copiar el enlace"
      className="mt-1 flex w-full items-center gap-1.5 rounded-[9px] border border-border bg-background px-2 py-1.5 text-left text-[11px] text-foreground hover:border-primary"
    >
      <span className="min-w-0 flex-1 truncate font-mono">{enlace}</span>
      {copiado ? <Check size={12} className="shrink-0 text-success" /> : <Copy size={12} className="shrink-0 text-muted" />}
    </button>
  );
}
