"use client";

import { useActionState, useState } from "react";
import { createAutomation } from "@/app/actions/automations";
import { AutomationActionsBuilder } from "@/components/automation-actions-builder";

type Tag = { id: string; name: string };

export function NewAutomationForm({ tags }: { tags: Tag[] }) {
  const [state, action, pending] = useActionState(createAutomation, undefined);
  const [triggerType, setTriggerType] = useState<"tag_added" | "keyword">("tag_added");

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Bienvenida a nuevos clientes"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Cuándo se activa</label>
        <select
          name="triggerType"
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value as "tag_added" | "keyword")}
          className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="tag_added">Cuando se asigna una etiqueta</option>
          <option value="keyword">Cuando llega un mensaje con una palabra clave</option>
        </select>

        {triggerType === "tag_added" ? (
          <select
            name="triggerTagId"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {tags.length === 0 && <option value="">No tienes etiquetas creadas</option>}
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            name="triggerKeyword"
            type="text"
            required
            placeholder="ej: precio, horario, información"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Qué hace</label>
        <AutomationActionsBuilder tags={tags} />
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Creando..." : "Crear automatización"}
      </button>
    </form>
  );
}
