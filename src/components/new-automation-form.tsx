"use client";

import { useActionState, useState } from "react";
import { createAutomation, updateAutomation } from "@/app/actions/automations";
import { AutomationActionsBuilder, type InitialAction } from "@/components/automation-actions-builder";
import { Button } from "@/components/ui/button";

type Tag = { id: string; name: string };
type Template = { id: string; meta_template_name: string; language: string; status: string };
type Agent = { id: string; name: string | null; email: string };
type QuickReply = { id: string; name: string };

type TriggerType = "tag_added" | "keyword" | "button_tap" | "any_message" | "first_message_of_day";

type ExistingAutomation = {
  id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_tag_id: string | null;
  trigger_keyword: string | null;
  actions: InitialAction[];
};

export function NewAutomationForm({
  tags,
  templates = [],
  agents = [],
  quickReplies = [],
  automation,
}: {
  tags: Tag[];
  templates?: Template[];
  agents?: Agent[];
  quickReplies?: QuickReply[];
  automation?: ExistingAutomation;
}) {
  const [state, action, pending] = useActionState(
    automation ? updateAutomation : createAutomation,
    undefined
  );
  const [triggerType, setTriggerType] = useState<TriggerType>(automation?.trigger_type ?? "tag_added");
  const [uploading, setUploading] = useState(false);

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
          onChange={(e) => setTriggerType(e.target.value as TriggerType)}
          className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="tag_added">Cuando se asigna una etiqueta</option>
          <option value="keyword">Cuando llega un mensaje con una palabra clave</option>
          <option value="button_tap">Cuando se toca un botón</option>
          <option value="any_message">Cuando el contacto escribe lo que sea (primera vez)</option>
          <option value="first_message_of_day">Cuando escribe por primera vez en el día</option>
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
        ) : triggerType === "button_tap" ? (
          <div>
            <input
              name="triggerKeyword"
              type="text"
              required
              defaultValue={automation?.trigger_keyword ?? ""}
              placeholder="Texto exacto del botón (ej: Sí, me interesa)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted">
              Debe coincidir exactamente con el texto del botón que configuraste en una plantilla, automatización
              o respuesta rápida.
            </p>
          </div>
        ) : triggerType === "keyword" ? (
          <div>
            <input
              name="triggerKeyword"
              type="text"
              required
              defaultValue={automation?.trigger_keyword ?? ""}
              placeholder="ej: hola, saludos, buenos días, buenas tardes"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted">
              Puedes poner varias palabras separadas por coma — se activa si el mensaje contiene
              cualquiera de ellas.
            </p>
          </div>
        ) : triggerType === "any_message" ? (
          <p className="text-xs text-muted">
            Se activa la primera vez que un contacto te escribe cualquier cosa (texto, foto, audio,
            lo que sea) — no necesitas escribir nada más aquí.
          </p>
        ) : (
          <p className="text-xs text-muted">
            Se activa cada día, la primera vez que ese contacto te escribe — se repite día tras día,
            a diferencia de los demás activadores que solo corren una vez por contacto.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Qué hace</label>
        <AutomationActionsBuilder
          tags={tags}
          templates={templates}
          agents={agents}
          quickReplies={quickReplies}
          initialActions={automation?.actions}
          allowWaitForReply
          onUploadingChange={setUploading}
        />
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

      <Button type="submit" disabled={pending || uploading} className="self-start">
        {uploading
          ? "Subiendo archivo..."
          : pending
            ? "Guardando..."
            : automation
              ? "Guardar cambios"
              : "Crear automatización"}
      </Button>
    </form>
  );
}
