"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteAgentProfile } from "@/app/actions/agents";

type Agent = {
  id: string;
  email: string;
  name: string | null;
};

export function AgentsList({ agents }: { agents: Agent[] }) {
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleDelete(agent: Agent) {
    const confirmed = window.confirm(
      `¿Eliminar al agente "${agent.name ?? agent.email}"? Sus conversaciones asignadas quedarán sin asignar.`
    );
    if (!confirmed) return;
    setPendingId(agent.id);
    startTransition(async () => {
      await deleteAgentProfile(agent.id);
      setPendingId(null);
    });
  }

  if (agents.length === 0) {
    return <p className="text-sm text-muted">Todavía no has creado agentes de respuesta.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {agents.map((agent) => (
        <li
          key={agent.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {(agent.name ?? agent.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{agent.name ?? "Sin nombre"}</p>
              <p className="text-xs text-muted">{agent.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDelete(agent)}
            disabled={pending && pendingId === agent.id}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            title="Eliminar agente"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
