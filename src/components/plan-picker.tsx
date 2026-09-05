"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { selectWorkspacePlan } from "@/app/actions/billing";

type Plan = {
  id: string;
  name: string;
  price_cents: number;
  compare_price_cents: number | null;
  savings_cents: number | null;
  currency: string;
  billing_cycle: string;
  badge_label: string | null;
  description: string[];
  modules: string[];
};

// Mismo formato de precio que usan las landings (formatCents en lib/billing/plans).
const fmt = (cents: number) => (cents / 100).toLocaleString("es-CO");

const cycleLabel: Record<string, string> = {
  monthly: "mes",
  semiannual: "6 meses",
  yearly: "año",
};

export function PlanPicker({ plans, currentPlanId }: { plans: Plan[]; currentPlanId: string | null }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(planId: string) {
    setPendingId(planId);
    setError(null);
    const result = await selectWorkspacePlan(planId);
    setPendingId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-xl border p-5 ${
                isCurrent ? "border-primary bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-foreground">{plan.name}</p>
                {plan.badge_label && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-white">
                    {plan.badge_label}
                  </span>
                )}
              </div>
              {plan.compare_price_cents !== null && (
                <p className="mt-1 text-xs text-muted line-through">
                  ${fmt(plan.compare_price_cents)} {plan.currency}
                </p>
              )}
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-foreground">
                  ${fmt(plan.price_cents)}
                </span>
                <span className="text-xs text-muted">
                  {plan.currency} / {cycleLabel[plan.billing_cycle] ?? plan.billing_cycle}
                </span>
              </div>
              {plan.savings_cents !== null && (
                <p className="mt-1.5 inline-flex w-fit items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                  Ahorras ${fmt(plan.savings_cents)} {plan.currency}
                </p>
              )}

              {(plan.description.length > 0 || plan.modules.length > 0) && (
                <ul className="mt-4 flex flex-col gap-1.5 text-sm text-muted">
                  {plan.description.map((line, i) => (
                    <li key={`d-${i}`} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-success" />
                      {line}
                    </li>
                  ))}
                  {plan.modules.map((m) => (
                    <li key={m} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-success" />
                      {m}
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => handleSelect(plan.id)}
                disabled={isCurrent || pendingId === plan.id}
                className={`mt-5 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                  isCurrent
                    ? "cursor-default bg-primary/15 text-primary"
                    : "bg-primary text-white hover:bg-primary-hover"
                }`}
              >
                {isCurrent
                  ? "Plan actual"
                  : pendingId === plan.id
                    ? "Seleccionando..."
                    : "Elegir este plan"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
