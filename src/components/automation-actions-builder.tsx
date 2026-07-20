"use client";

import { useState } from "react";
import { Trash2, Plus, Info } from "lucide-react";
import { uploadAutomationActionMedia } from "@/app/actions/automations";

type Tag = { id: string; name: string };
type Template = { id: string; meta_template_name: string; language: string; status: string };

type ActionType =
  | "send_message"
  | "add_tag"
  | "send_image"
  | "send_video"
  | "send_audio"
  | "send_document"
  | "send_template";

type ActionRow = {
  action_type: ActionType;
  message_body: string;
  tag_id: string;
  media_url: string;
  media_filename: string;
  template_id: string;
};

export type InitialAction = {
  action_type: ActionType;
  message_body: string | null;
  tag_id: string | null;
  media_url?: string | null;
  media_filename?: string | null;
  template_id?: string | null;
};

const mediaLabel: Record<string, string> = {
  send_image: "Imagen",
  send_video: "Video",
  send_audio: "Audio / nota de voz",
  send_document: "Documento",
};

const mediaAccept: Record<string, string> = {
  send_image: "image/*",
  send_video: "video/*",
  send_audio: "audio/*",
  send_document: "application/pdf,.doc,.docx,.xls,.xlsx",
};

function emptyRow(defaultTagId: string): ActionRow {
  return {
    action_type: "send_message",
    message_body: "",
    tag_id: defaultTagId,
    media_url: "",
    media_filename: "",
    template_id: "",
  };
}

export function AutomationActionsBuilder({
  tags,
  templates = [],
  initialActions,
}: {
  tags: Tag[];
  templates?: Template[];
  initialActions?: InitialAction[];
}) {
  const [actions, setActions] = useState<ActionRow[]>(
    initialActions && initialActions.length > 0
      ? initialActions.map((a) => ({
          action_type: a.action_type,
          message_body: a.message_body ?? "",
          tag_id: a.tag_id ?? tags[0]?.id ?? "",
          media_url: a.media_url ?? "",
          media_filename: a.media_filename ?? "",
          template_id: a.template_id ?? templates[0]?.id ?? "",
        }))
      : [emptyRow(tags[0]?.id ?? "")]
  );
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  function updateAction(index: number, patch: Partial<ActionRow>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function addAction() {
    setActions((prev) => [...prev, emptyRow(tags[0]?.id ?? "")]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFile(index: number, file: File) {
    setUploadingIndex(index);
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadAutomationActionMedia(formData);
    setUploadingIndex(null);
    if (result.error) {
      setUploadError(result.error);
      return;
    }
    updateAction(index, { media_url: result.url, media_filename: result.filename });
  }

  const serialized = actions.map((a) => ({
    action_type: a.action_type,
    message_body: a.action_type === "send_message" ? a.message_body : undefined,
    tag_id: a.action_type === "add_tag" ? a.tag_id : undefined,
    media_url: mediaLabel[a.action_type] ? a.media_url : undefined,
    media_filename: a.action_type === "send_document" ? a.media_filename : undefined,
    template_id: a.action_type === "send_template" ? a.template_id : undefined,
  }));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="actionsJson" value={JSON.stringify(serialized)} />

      {actions.map((action, index) => (
        <div key={index} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <select
              value={action.action_type}
              onChange={(e) =>
                updateAction(index, { action_type: e.target.value as ActionType })
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="send_message">Enviar mensaje de texto</option>
              <option value="send_image">Enviar imagen</option>
              <option value="send_video">Enviar video</option>
              <option value="send_audio">Enviar audio / nota de voz</option>
              <option value="send_document">Enviar documento</option>
              <option value="send_template">Enviar plantilla aprobada</option>
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

          {action.action_type === "send_message" && (
            <textarea
              value={action.message_body}
              onChange={(e) => updateAction(index, { message_body: e.target.value })}
              rows={2}
              placeholder="Mensaje a enviar..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          )}

          {action.action_type === "add_tag" && (
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

          {mediaLabel[action.action_type] && (
            <div className="flex flex-col gap-2">
              <input
                type="file"
                accept={mediaAccept[action.action_type]}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(index, file);
                }}
                className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-hover"
              />
              {uploadingIndex === index && (
                <p className="text-xs text-muted">Subiendo archivo...</p>
              )}
              {action.media_url && uploadingIndex !== index && (
                <p className="truncate text-xs text-success">
                  ✓ {action.media_filename || "Archivo listo"}
                </p>
              )}
            </div>
          )}

          {action.action_type === "send_template" && (
            <div className="flex flex-col gap-2">
              <select
                value={action.template_id}
                onChange={(e) => updateAction(index, { template_id: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {approvedTemplates.length === 0 && (
                  <option value="">No tienes plantillas aprobadas</option>
                )}
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.meta_template_name} ({t.language})
                  </option>
                ))}
              </select>
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <Info size={13} className="mt-0.5 shrink-0" />
                Usa plantillas para reabrir la conversación con un contacto aunque ya hayan
                pasado más de 24 horas desde su último mensaje — es la única forma que permite
                WhatsApp de escribirle primero fuera de esa ventana.
              </p>
            </div>
          )}
        </div>
      ))}

      {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

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
