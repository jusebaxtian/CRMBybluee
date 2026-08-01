"use client";

import { useActionState, useState } from "react";
import { createQuickReply, updateQuickReply } from "@/app/actions/quick-replies";
import { AutomationActionsBuilder, type InitialAction } from "@/components/automation-actions-builder";

type Tag = { id: string; name: string };
type Template = { id: string; meta_template_name: string; language: string; status: string };

type ExistingQuickReply = {
  id: string;
  name: string;
  actions: InitialAction[];
};

export function NewQuickReplyForm({
  tags,
  templates = [],
  quickReply,
}: {
  tags: Tag[];
  templates?: Template[];
  quickReply?: ExistingQuickReply;
}) {
  const [state, action, pending] = useActionState(
    quickReply ? updateQuickReply : createQuickReply,
    undefined
  );
  const [uploading, setUploading] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      {quickReply && <input type="hidden" name="quickReplyId" value={quickReply.id} />}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={quickReply?.name}
          placeholder="Horario de atención"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Qué envía</label>
        <AutomationActionsBuilder
          tags={tags}
          templates={templates}
          initialActions={quickReply?.actions}
          hideAgentActions
          showDelay={false}
          onUploadingChange={setUploading}
        />
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || uploading}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {uploading
          ? "Subiendo archivo..."
          : pending
            ? "Guardando..."
            : quickReply
              ? "Guardar cambios"
              : "Crear respuesta rápida"}
      </button>
    </form>
  );
}
