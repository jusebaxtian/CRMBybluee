"use client";

import { useActionState, useState } from "react";
import { Info } from "lucide-react";
import { createFollowupSequence, updateFollowupSequence } from "@/app/actions/followups";
import { AutomationActionsBuilder, type InitialAction } from "@/components/automation-actions-builder";

type Tag = { id: string; name: string };
type Template = { id: string; meta_template_name: string; language: string; status: string };
type Agent = { id: string; name: string | null; email: string };
type QuickReply = { id: string; name: string };

type ExistingSequence = {
  id: string;
  name: string;
  actions: InitialAction[];
};

export function NewFollowupSequenceForm({
  tags,
  templates = [],
  agents = [],
  quickReplies = [],
  sequence,
}: {
  tags: Tag[];
  templates?: Template[];
  agents?: Agent[];
  quickReplies?: QuickReply[];
  sequence?: ExistingSequence;
}) {
  const [state, action, pending] = useActionState(
    sequence ? updateFollowupSequence : createFollowupSequence,
    undefined
  );
  const [uploading, setUploading] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      {sequence && <input type="hidden" name="sequenceId" value={sequence.id} />}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={sequence?.name}
          placeholder="Seguimiento estándar"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <p className="flex items-start gap-1.5 rounded-lg border border-border bg-background p-3 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0" />
        Se activa cuando le envías un mensaje a un contacto y no responde. Cada paso espera el
        tiempo que definas desde ese mensaje sin respuesta — mantén los tiempos dentro de las 24
        horas de la ventana de WhatsApp, o usa una plantilla para el último paso, que sí funciona
        fuera de ella. Los contactos con la etiqueta &quot;No interesados&quot; (o cualquier
        etiqueta marcada como excluida) nunca reciben estos mensajes, y puedes desactivarlo para
        un contacto puntual desde su conversación.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Pasos del seguimiento</label>
        <AutomationActionsBuilder
          tags={tags}
          templates={templates}
          agents={agents}
          quickReplies={quickReplies}
          initialActions={sequence?.actions}
          showDelay
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
            : sequence
              ? "Guardar cambios"
              : "Crear seguimiento"}
      </button>
    </form>
  );
}
