"use client";

import { useActionState, useState } from "react";
import { createNotification } from "@/app/actions/notifications";

type Workspace = { id: string; name: string };
type Plan = { id: string; name: string };

export function CreateNotificationForm({
  workspaces,
  plans,
}: {
  workspaces: Workspace[];
  plans: Plan[];
}) {
  const [state, action, pending] = useActionState(createNotification, undefined);
  const [scope, setScope] = useState<"all" | "workspace" | "plan">("all");

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
          onChange={(e) => setScope(e.target.value as "all" | "workspace" | "plan")}
          className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="all">Todos los workspaces</option>
          <option value="workspace">Un workspace específico</option>
          <option value="plan">Un plan específico</option>
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
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-sm text-success">Notificación enviada.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Enviar notificación"}
      </button>
    </form>
  );
}
