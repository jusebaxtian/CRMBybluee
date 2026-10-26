"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { useRouter } from "next/navigation";
import { canjearMesReferido } from "@/app/actions/referidos";

/** Aviso en Facturacion: sirve para reactivar una cuenta vencida con un mes ganado. */
export function UsarMesGratis({ disponibles }: { disponibles: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 p-5">
      <div className="flex items-center gap-3">
        <Gift size={20} className="shrink-0 text-success" />
        <p className="text-sm text-foreground">
          Tienes {disponibles} {disponibles === 1 ? "mes gratis" : "meses gratis"} por tus referidos. Úsalo y se suma a tu plan.
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              setError(null);
              const r = await canjearMesReferido();
              if ("error" in r) setError(r.error);
              else router.refresh();
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pendiente ? "Aplicando…" : "Usar 1 mes gratis"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
