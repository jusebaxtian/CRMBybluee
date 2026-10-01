"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { guardarLineaDelFlujo } from "@/app/actions/flujos";

/**
 * Por qué línea sale el flujo.
 *
 * Importa en los dos sentidos: por esa línea salen sus mensajes, y solo los
 * mensajes que lleguen por ella lo disparan. Sin esto, un contacto que
 * escribe a soporte podía caer en el flujo de ventas.
 */
export function LineaDelFlujo({
  flujoId,
  lineaActual,
  lineas,
}: {
  flujoId: string;
  lineaActual: string | null;
  lineas: { id: string; label: string | null; display_phone_number: string }[];
}) {
  const router = useRouter();
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (lineas.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Smartphone size={14} className="shrink-0 text-muted" />
        <select
          value={lineaActual ?? ""}
          disabled={guardando}
          onChange={(e) =>
            guardar(async () => {
              setError(null);
              const r = await guardarLineaDelFlujo(flujoId, e.target.value || null);
              if ("error" in r && r.error) setError(r.error);
              else router.refresh();
            })
          }
          className="rounded-[9px] border border-border bg-background px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
        >
          <option value="">Línea principal del espacio</option>
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label ? `${l.display_phone_number} · ${l.label}` : l.display_phone_number}
            </option>
          ))}
        </select>
      </div>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
