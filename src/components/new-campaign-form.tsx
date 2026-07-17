"use client";

import { useActionState } from "react";
import { createCampaign } from "@/app/actions/campaigns";

type Template = { id: string; meta_template_name: string; status: string };
type Tag = { id: string; name: string };

export function NewCampaignForm({
  templates,
  tags,
}: {
  templates: Template[];
  tags: Tag[];
}) {
  const [state, action, pending] = useActionState(createCampaign, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
          Nombre de la campaña
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="templateId" className="mb-1 block text-sm font-medium text-muted">
          Plantilla
        </label>
        {templates.length === 0 ? (
          <p className="text-sm text-red-400">
            No tienes plantillas aprobadas. Sincronízalas desde el módulo de Plantillas.
          </p>
        ) : (
          <select
            id="templateId"
            name="templateId"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.meta_template_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="audienceTagId" className="mb-1 block text-sm font-medium text-muted">
          Audiencia
        </label>
        <select
          id="audienceTagId"
          name="audienceTagId"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Todos los contactos</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              Etiqueta: {t.name}
            </option>
          ))}
        </select>
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || templates.length === 0}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Creando..." : "Crear campaña"}
      </button>
    </form>
  );
}
