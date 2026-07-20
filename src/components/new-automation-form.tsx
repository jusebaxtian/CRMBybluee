"use client";

import { useActionState, useState } from "react";
import { createAutomation, updateAutomation } from "@/app/actions/automations";
import { AutomationActionsBuilder, type InitialAction } from "@/components/automation-actions-builder";

type Tag = { id: string; name: string };
type Template = { id: string; meta_template_name: string; language: string; status: string };

type ExistingAutomation = {
  id: string;
  name: string;
  trigger_type: "tag_added" | "keyword";
  trigger_tag_id: string | null;
  trigger_keyword: string | null;
  actions: InitialAction[];
};

export function NewAutomationForm({
  tags,
  templates = [],
  automation,
}: {
  tags: Tag[];
  templates?: Template[];
  automation?: ExistingAutomation;
}) {
  const [state, action, pending] = useActionState(
    automation ? updateAutomation : createAutomation,
    undefined
  );
  const [triggerType, setTriggerType] = useState<"tag_added" | "keyword">(
    automation?.trigger_type ?? "tag_added"
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      {automation && <input type="hidden" name="automationId" value={automation.id} />}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={automation?.name}
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
            defaultValue={automation?.trigger_tag_id ?? ""}
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
            defaultValue={automation?.trigger_keyword ?? ""}
            placeholder="ej: precio, horario, información"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Qué hace</label>
        <AutomationActionsBuilder
          tags={tags}
          templates={templates}
          initialActions={automation?.actions}
        />
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Guardando..." : automation ? "Guardar cambios" : "Crear automatización"}
      </button>
    </form>
  );
}
