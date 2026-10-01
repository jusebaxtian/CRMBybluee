"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Workflow } from "lucide-react";
import { meterContactoEnFlujo } from "@/app/actions/flujos";

/**
 * Meter al contacto a un flujo desde el chat.
 *
 * Solo aparece si el espacio tiene flujos activos con entrada manual: un
 * botón que nunca hace nada es peor que no tener botón.
 */
export function MeterEnFlujo({
  contactId,
  conversationId,
  flujos,
}: {
  contactId: string;
  conversationId: string | null;
  flujos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [metiendo, meter] = useTransition();

  if (flujos.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAbierto((a) => !a);
        }}
        title="Meter a un flujo"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
      >
        {listo ? <Check size={15} className="text-success" /> : <Workflow size={15} />}
      </button>

      {abierto && (
        <div className="absolute right-0 top-9 z-30 w-60 rounded-[11px] border border-border bg-surface p-2 shadow-lg">
          <p className="px-1.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            Meter a un flujo
          </p>
          {flujos.map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={metiendo}
              onClick={() =>
                meter(async () => {
                  setError(null);
                  const r = await meterContactoEnFlujo(f.id, contactId, conversationId);
                  if ("error" in r && r.error) {
                    setError(r.error);
                    return;
                  }
                  setListo(true);
                  setAbierto(false);
                  router.refresh();
                })
              }
              className="w-full truncate rounded-[8px] px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-surface-hover disabled:opacity-50"
            >
              {f.nombre}
            </button>
          ))}
          {error && (
            <p className="mt-1 rounded-[8px] border border-red-400/40 bg-red-400/10 px-2 py-1.5 text-[11px] leading-relaxed text-foreground">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
