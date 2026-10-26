"use client";

import { useState, useTransition } from "react";
import { resolverReferido } from "@/app/actions/referidos";

/** Aprobar o rechazar un referido que quedo "en revision" (posible autoreferido). */
export function ReferidosRevision({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const decidir = (aprobar: boolean) =>
    empezar(async () => {
      setError(null);
      const r = await resolverReferido(id, aprobar);
      if ("error" in r) setError(r.error);
    });

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => decidir(true)}
        className="rounded-md bg-success/15 px-2 py-0.5 text-xs font-medium text-success disabled:opacity-60"
      >
        Aprobar
      </button>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => decidir(false)}
        className="rounded-md bg-error/15 px-2 py-0.5 text-xs font-medium text-error disabled:opacity-60"
      >
        Rechazar
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </span>
  );
}
