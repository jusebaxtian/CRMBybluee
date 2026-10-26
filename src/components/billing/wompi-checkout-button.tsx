"use client";

import { useState, useTransition } from "react";
import { crearPagoWompi } from "@/app/actions/wompi";

export function WompiCheckoutButton({ planId }: { planId?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await crearPagoWompi(planId ?? null);
            if ("error" in r) setError(r.error);
            else window.location.href = r.url;
          })
        }
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Preparando…" : "Pagar con Wompi"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
