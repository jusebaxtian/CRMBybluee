"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlanPrice } from "@/app/actions/plans";

export function PlanPriceEditor({
  planId,
  initialPriceCents,
}: {
  planId: string;
  initialPriceCents: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialPriceCents / 100));
  const [pending, setPending] = useState(false);

  async function handleSave() {
    const priceCop = Number(value);
    if (!priceCop || priceCop <= 0) return;
    setPending(true);
    await updatePlanPrice(planId, priceCop);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">$</span>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
      />
      <span className="text-sm text-muted">COP/mes</span>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "..." : "Guardar"}
      </button>
    </div>
  );
}
