"use client";

import { useState, useTransition } from "react";
import { cambiarEtapaDelLead } from "@/app/actions/leads";
import { ESTILO_ETAPA, ETAPAS, type Etapa } from "@/lib/leads/etapas";

/** La etapa del contacto en el panel del chat. Se ve como insignia y se cambia tocandola. */
export function EtapaDelLead({ contactId, etapa }: { contactId: string; etapa: Etapa }) {
  const [actual, setActual] = useState(etapa);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // El servidor manda: si la etapa avanza sola mientras el chat esta abierto, se actualiza.
  const [recibida, setRecibida] = useState(etapa);
  if (etapa !== recibida) {
    setRecibida(etapa);
    setActual(etapa);
  }

  function cambiar(nueva: Etapa) {
    const anterior = actual;
    setActual(nueva);
    setError(null);
    startTransition(async () => {
      const r = await cambiarEtapaDelLead(contactId, nueva);
      if (r.error) {
        setActual(anterior);
        setError(r.error);
      }
    });
  }

  return (
    <div className="mt-1">
      <select
        aria-label="Etapa del lead"
        value={actual}
        disabled={pendiente}
        onChange={(e) => cambiar(e.target.value as Etapa)}
        className={`cursor-pointer rounded-full border-0 px-2 py-0.5 text-[10.5px] font-semibold outline-none ${ESTILO_ETAPA[actual].clase}`}
      >
        {ETAPAS.map((e) => (
          <option key={e} value={e} className="bg-surface text-foreground">
            {ESTILO_ETAPA[e].texto}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
