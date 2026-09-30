"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { activarFlujo } from "@/app/actions/flujos";

/** Interruptor del flujo. Activar es lo único que lo pone a correr de verdad. */
export function ActivarFlujo({ flujoId, activo }: { flujoId: string; activo: boolean }) {
  const router = useRouter();
  const [cambiando, cambiar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={cambiando}
        onClick={() =>
          cambiar(async () => {
            setError(null);
            const r = await activarFlujo(flujoId, !activo);
            if ("error" in r && r.error) setError(r.error);
            else router.refresh();
          })
        }
        className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[13px] font-semibold ${
          activo
            ? "border-border text-foreground hover:bg-surface-hover"
            : "border-transparent bg-primary text-white hover:bg-primary-hover"
        } disabled:opacity-50`}
      >
        {activo ? <Pause size={13} /> : <Play size={13} />}
        {cambiando ? "Un momento…" : activo ? "Pausar flujo" : "Activar flujo"}
      </button>
      {error && <span className="max-w-[320px] text-right text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
