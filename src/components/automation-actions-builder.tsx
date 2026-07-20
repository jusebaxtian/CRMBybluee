"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";

type Tag = { id: string; name: string };
type ActionRow = { action_type: "send_message" | "add_tag"; message_body: string; tag_id: string };
export type InitialAction = {
  action_type: "send_message" | "add_tag";
  message_body: string | null;
  tag_id: string | null;
};

export function AutomationActionsBuilder({
  tags,
  initialActions,
}: {
  tags: Tag[];
  initialActions?: InitialAction[];
}) {
  const [actions, setActions] = useState<ActionRow[]>(
    initialActions && initialActions.length > 0
      ? initialActions.map((a) => ({
          action_type: a.action_type,
          message_body: a.message_body ?? "",
          tag_id: a.tag_id ?? tags[0]?.id ?? "",
        }))
      : [{ action_type: "send_message", message_body: "", tag_id: tags[0]?.id ?? "" }]
  );

  function updateAction(index: number, patch: Partial<ActionRow>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function addAction() {
    setActions((prev) => [
      ...prev,
      { action_type: "send_message", message_body: "", tag_id: tags[0]?.id ?? "" },
    ]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  const serialized = actions.map((a) =>
    a.action_type === "send_message"
      ? { action_type: "send_message", message_body: a.message_body }
      : { action_type: "add_tag", tag_id: a.tag_id }
  );

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="actionsJson" value={JSON.stringify(serialized)} />

      {actions.map((action, index) => (
        <div key={index} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <select
              value={action.action_type}
              onChange={(e) =>
                updateAction(index, { action_type: e.target.value as ActionRow["action_type"] })
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="send_message">Enviar mensaje</option>
              <option value="add_tag">Agregar etiqueta</option>
            </select>
            {actions.length > 1 && (
              <button
                type="button"
                onClick={() => removeAction(index)}
                className="text-muted hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {action.action_type === "send_message" ? (
            <textarea
              value={action.message_body}
              onChange={(e) => updateAction(index, { message_body: e.target.value })}
              rows={2}
              placeholder="Mensaje a enviar..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          ) : (
            <select
              value={action.tag_id}
              onChange={(e) => updateAction(index, { tag_id: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {tags.length === 0 && <option value="">No hay etiquetas</option>}
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addAction}
        className="flex items-center gap-1.5 self-start text-sm text-primary hover:underline"
      >
        <Plus size={14} />
        Agregar otra acción
      </button>
    </div>
  );
}
