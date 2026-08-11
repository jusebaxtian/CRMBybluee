"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { togglePlanActive } from "@/app/actions/plans";

export function PlanActiveToggle({
  planId,
  isActive,
}: {
  planId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState(isActive);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    const next = !active;
    const result = await togglePlanActive(planId, next);
    setPending(false);
    if (!result?.error) {
      setActive(next);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={`rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        active
          ? "border-success text-success hover:bg-success/10"
          : "border-border text-muted hover:bg-surface-hover"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </button>
  );
}
