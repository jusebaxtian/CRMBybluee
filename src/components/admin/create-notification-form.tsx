"use client";

import { useActionState, useState } from "react";
import { createNotification } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";

type Workspace = { id: string; name: string };
type Plan = { id: string; name: string };

const statusLabel: Record<string, string> = {
  trialing: "En periodo de prueba",
  active: "Activos (con pago)",
  past_due: "Sin pago / vencidos",
  canceled: "Cancelados",
};

export function CreateNotificationForm({
  workspaces,
  plans,
}: {
  workspaces: Workspace[];
  plans: Plan[];
}) {
  const [state, action, pending] = useActionState(createNotification, undefined);
  const [scope, setScope] = useState<"all" | "workspace" | "plan" | "status">("all");

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-muted">
          Título
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="body" className="mb-1 block text-sm font-medium text-muted">
          Contenido
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Alcance</label>
        <select
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as "all" | "workspace" | "plan" | "status")}
          className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="all">Todos los workspaces</option>
          <option value="workspace">Un workspace específico</option>
          <option value="plan">Un plan específico</option>
          <option value="status">Un estado de cuenta específico</option>
        </select>

        {scope === "workspace" && (
          <select
            name="targetWorkspaceId"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}

        {scope === "plan" && (
          <select
            name="targetPlanId"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {scope === "status" && (
          <select
            name="targetStatus"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startsAt" className="mb-1 block text-sm font-medium text-muted">
            Empieza a mostrarse
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="date"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted">Vacío = inmediatamente.</p>
        </div>
        <div>
          <label htmlFor="endsAt" className="mb-1 block text-sm font-medium text-muted">
            Deja de mostrarse
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="date"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted">Vacío = sin fecha límite.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ctaLabel" className="mb-1 block text-sm font-medium text-muted">
            Texto del botón (opcional)
          </label>
          <input
            id="ctaLabel"
            name="ctaLabel"
            type="text"
            placeholder="Ver más"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="ctaUrl" className="mb-1 block text-sm font-medium text-muted">
            URL del botón (opcional)
          </label>
          <input
            id="ctaUrl"
            name="ctaUrl"
            type="url"
            placeholder="https://..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-sm text-success">Notificación enviada.</p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar notificación"}
      </Button>
    </form>
  );
}
