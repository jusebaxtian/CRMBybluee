"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlanLimits } from "@/app/actions/plans";

// Empty input = unlimited (stored as null), matching how the rest of the
// app reads these columns (agents.ts, whatsapp.ts's connect flow).
function toValue(n: number | null): string {
  return n === null ? "" : String(n);
}
function toLimit(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Math.max(0, Math.floor(Number(v)));
  return Number.isFinite(n) ? n : null;
}

export function PlanLimitsEditor({
  planId,
  initialMaxAgents,
  initialMaxWhatsappNumbers,
}: {
  planId: string;
  initialMaxAgents: number | null;
  initialMaxWhatsappNumbers: number | null;
}) {
  const router = useRouter();
  const [maxAgents, setMaxAgents] = useState(toValue(initialMaxAgents));
  const [maxNumbers, setMaxNumbers] = useState(toValue(initialMaxWhatsappNumbers));
  const [pending, setPending] = useState(false);

  async function handleSave() {
    setPending(true);
    await updatePlanLimits(planId, {
      maxAgents: toLimit(maxAgents),
      maxWhatsappNumbers: toLimit(maxNumbers),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Agentes de respuesta</label>
        <input
          type="number"
          min={0}
          value={maxAgents}
          onChange={(e) => setMaxAgents(e.target.value)}
          placeholder="Sin límite"
          className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Números de WhatsApp</label>
        <input
          type="number"
          min={0}
          value={maxNumbers}
          onChange={(e) => setMaxNumbers(e.target.value)}
          placeholder="Sin límite"
          className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "..." : "Guardar límites"}
      </button>
      <p className="w-full text-[11px] text-muted">Deja el campo vacío para "sin límite".</p>
    </div>
  );
}
