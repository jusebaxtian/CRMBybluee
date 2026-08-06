"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createAgentProfile } from "@/app/actions/agents";
import { Button } from "@/components/ui/button";

export function AgentProfileForm() {
  const [state, action, pending] = useActionState(createAgentProfile, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <UserPlus size={14} />
        Crear nuevo agente
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          name="name"
          type="text"
          required
          placeholder="Nombre"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="correo@ejemplo.com"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Contraseña (mín. 8)"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      {state && "error" in state && <p className="text-xs text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-xs text-success">Agente creado correctamente.</p>
      )}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creando..." : "Crear agente"}
      </Button>
    </form>
  );
}
