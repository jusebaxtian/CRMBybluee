"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWorkspacePlan, updateWorkspaceStatus } from "@/app/actions/admin";

type Plan = { id: string; name: string };

export function WorkspaceAdminEditor({
  workspaceId,
  currentPlanId,
  currentStatus,
  plans,
}: {
  workspaceId: string;
  currentPlanId: string | null;
  currentStatus: string;
  plans: Plan[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handlePlanChange(planId: string) {
    setPending(true);
    await updateWorkspacePlan(workspaceId, planId);
    setPending(false);
    router.refresh();
  }

  async function handleStatusChange(status: string) {
    setPending(true);
    await updateWorkspaceStatus(workspaceId, status);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Plan</label>
        <select
          defaultValue={currentPlanId ?? ""}
          onChange={(e) => handlePlanChange(e.target.value)}
          disabled={pending}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Estado</label>
        <select
          defaultValue={currentStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={pending}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="trialing">Prueba</option>
          <option value="active">Activo</option>
          <option value="past_due">Pago pendiente</option>
          <option value="canceled">Cancelado</option>
        </select>
      </div>
    </div>
  );
}
