"use client";

import { useState } from "react";
import { Trash2, Plus, Info, ChevronUp, ChevronDown, Clock } from "lucide-react";

// Uploads via XHR (not the uploadAutomationActionMedia server action) so we
// can report real progress — fetch/Server Actions don't expose upload
// progress events, XHR's upload.onprogress does.
function uploadWithProgress(
  file: File,
  actionType: string,
  onProgress: (percent: number) => void
): Promise<{ url: string; filename: string } | { error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/automation-media");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          resolve({ url: data.url, filename: data.filename });
        } else {
          resolve({ error: data.error ?? "No se pudo subir el archivo." });
        }
      } catch {
        resolve({ error: "No se pudo subir el archivo." });
      }
    };
    xhr.onerror = () => resolve({ error: "No se pudo subir el archivo. Revisa tu conexión." });
    const formData = new FormData();
    formData.set("file", file);
    formData.set("actionType", actionType);
    xhr.send(formData);
  });
}

type Tag = { id: string; name: string };
type Template = { id: string; meta_template_name: string; language: string; status: string };
type Agent = { id: string; name: string | null; email: string };

type ActionType =
  | "send_message"
  | "add_tag"
  | "send_image"
  | "send_video"
  | "send_audio"
  | "send_document"
  | "send_template"
  | "assign_agent"
  | "assign_agent_random";

type AgentShare = { agent_id: string; percent: number };

type ActionRow = {
  action_type: ActionType;
  message_body: string;
  tag_id: string;
  media_url: string;
  media_filename: string;
  template_id: string;
  target_agent_id: string;
  agent_distribution: AgentShare[];
  delay_value: number;
  delay_unit: "seconds" | "minutes";
};

export type InitialAction = {
  action_type: ActionType;
  message_body: string | null;
  tag_id: string | null;
  media_url?: string | null;
  media_filename?: string | null;
  template_id?: string | null;
  target_agent_id?: string | null;
  agent_distribution?: AgentShare[] | null;
  delay_seconds?: number | null;
};

const mediaLabel: Record<string, string> = {
  send_image: "Imagen",
  send_video: "Video",
  send_audio: "Audio / nota de voz",
  send_document: "Documento",
};

// Matches WhatsApp Cloud API's actual supported mime types per media kind
// (see allowedMimesByActionType in /api/automation-media/route.ts) — not
// a generic "video/*"/"image/*", which lets browsers offer formats WhatsApp
// will reject at send time.
const mediaAccept: Record<string, string> = {
  send_image: "image/jpeg,image/png",
  send_video: "video/mp4,video/3gpp",
  send_audio: "audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg",
  send_document: "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
};

// Audio messages don't support a caption in the Cloud API.
const captionableTypes = new Set(["send_message", "send_image", "send_video", "send_document"]);

function emptyRow(defaultTagId: string): ActionRow {
  return {
    action_type: "send_message",
    message_body: "",
    tag_id: defaultTagId,
    media_url: "",
    media_filename: "",
    template_id: "",
    target_agent_id: "",
    agent_distribution: [],
    delay_value: 0,
    delay_unit: "seconds",
  };
}

function toDelayValueUnit(seconds: number | null | undefined): { value: number; unit: "seconds" | "minutes" } {
  const s = seconds ?? 0;
  if (s > 0 && s % 60 === 0) return { value: s / 60, unit: "minutes" };
  return { value: s, unit: "seconds" };
}

export function AutomationActionsBuilder({
  tags,
  templates = [],
  agents = [],
  initialActions,
  hideAgentActions = false,
  showDelay = true,
  onUploadingChange,
}: {
  tags: Tag[];
  templates?: Template[];
  agents?: Agent[];
  initialActions?: InitialAction[];
  hideAgentActions?: boolean;
  showDelay?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [actions, setActions] = useState<ActionRow[]>(
    initialActions && initialActions.length > 0
      ? initialActions.map((a) => {
          const { value, unit } = toDelayValueUnit(a.delay_seconds);
          return {
            action_type: a.action_type,
            message_body: a.message_body ?? "",
            tag_id: a.tag_id ?? tags[0]?.id ?? "",
            media_url: a.media_url ?? "",
            media_filename: a.media_filename ?? "",
            template_id: a.template_id ?? templates[0]?.id ?? "",
            target_agent_id: a.target_agent_id ?? agents[0]?.id ?? "",
            agent_distribution: a.agent_distribution ?? [],
            delay_value: value,
            delay_unit: unit,
          };
        })
      : [emptyRow(tags[0]?.id ?? "")]
  );
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");

  function updateAction(index: number, patch: Partial<ActionRow>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function addAgentShare(actionIndex: number) {
    setActions((prev) =>
      prev.map((a, i) => {
        if (i !== actionIndex) return a;
        const usedIds = new Set(a.agent_distribution.map((d) => d.agent_id));
        const nextAgent = agents.find((ag) => !usedIds.has(ag.id));
        if (!nextAgent) return a;
        return {
          ...a,
          agent_distribution: [...a.agent_distribution, { agent_id: nextAgent.id, percent: 0 }],
        };
      })
    );
  }

  function updateAgentShare(actionIndex: number, shareIndex: number, patch: Partial<AgentShare>) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === actionIndex
          ? {
              ...a,
              agent_distribution: a.agent_distribution.map((d, j) =>
                j === shareIndex ? { ...d, ...patch } : d
              ),
            }
          : a
      )
    );
  }

  function removeAgentShare(actionIndex: number, shareIndex: number) {
    setActions((prev) =>
      prev.map((a, i) =>
        i === actionIndex
          ? { ...a, agent_distribution: a.agent_distribution.filter((_, j) => j !== shareIndex) }
          : a
      )
    );
  }

  function addAction() {
    setActions((prev) => [...prev, emptyRow(tags[0]?.id ?? "")]);
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  function moveAction(index: number, direction: -1 | 1) {
    setActions((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleFile(index: number, file: File) {
    setUploadingIndex(index);
    setUploadProgress(0);
    setUploadError(null);
    onUploadingChange?.(true);
    const result = await uploadWithProgress(file, actions[index].action_type, setUploadProgress);
    setUploadingIndex(null);
    onUploadingChange?.(false);
    if ("error" in result) {
      setUploadError(result.error);
      return;
    }
    updateAction(index, { media_url: result.url, media_filename: result.filename });
  }

  const serialized = actions.map((a) => ({
    action_type: a.action_type,
    message_body: captionableTypes.has(a.action_type) ? a.message_body || undefined : undefined,
    tag_id: a.action_type === "add_tag" ? a.tag_id : undefined,
    media_url: mediaLabel[a.action_type] ? a.media_url : undefined,
    media_filename: a.action_type === "send_document" ? a.media_filename : undefined,
    template_id: a.action_type === "send_template" ? a.template_id : undefined,
    target_agent_id: a.action_type === "assign_agent" ? a.target_agent_id : undefined,
    agent_distribution: a.action_type === "assign_agent_random" ? a.agent_distribution : undefined,
    delay_seconds: a.delay_value > 0 ? a.delay_value * (a.delay_unit === "minutes" ? 60 : 1) : 0,
  }));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="actionsJson" value={JSON.stringify(serialized)} />

      {actions.map((action, index) => (
        <div key={index} className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
              {index + 1}
            </span>
            <select
              value={action.action_type}
              onChange={(e) => updateAction(index, { action_type: e.target.value as ActionType })}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="send_message">Enviar mensaje de texto</option>
              <option value="send_image">Enviar imagen</option>
              <option value="send_video">Enviar video</option>
              <option value="send_audio">Enviar audio / nota de voz</option>
              <option value="send_document">Enviar documento</option>
              <option value="send_template">Enviar plantilla aprobada</option>
              <option value="add_tag">Agregar etiqueta</option>
              {!hideAgentActions && (
                <>
                  <option value="assign_agent">Asignar a un agente</option>
                  <option value="assign_agent_random">Asignar aleatoriamente (%) entre agentes</option>
                </>
              )}
            </select>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => moveAction(index, -1)}
                disabled={index === 0}
                className="text-muted hover:text-foreground disabled:opacity-30"
                title="Mover arriba"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveAction(index, 1)}
                disabled={index === actions.length - 1}
                className="text-muted hover:text-foreground disabled:opacity-30"
                title="Mover abajo"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            {actions.length > 1 && (
              <button
                type="button"
                onClick={() => removeAction(index)}
                className="shrink-0 text-muted hover:text-red-400"
                title="Eliminar acción"
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
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted">Subiendo archivo... {uploadProgress}%</p>
                </div>
              )}
              {action.media_url && uploadingIndex !== index && (
                <p className="truncate text-xs text-success">
                  ✓ {action.media_filename || "Archivo listo"}
                </p>
              )}
              {captionableTypes.has(action.action_type) && (
                <textarea
                  value={action.message_body}
                  onChange={(e) => updateAction(index, { message_body: e.target.value })}
                  rows={2}
                  placeholder="Texto que acompaña la imagen/video/documento (opcional)"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              )}
            </div>
          )}

          {action.action_type === "assign_agent" && (
            <select
              value={action.target_agent_id}
              onChange={(e) => updateAction(index, { target_agent_id: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {agents.length === 0 && <option value="">No tienes agentes creados</option>}
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </select>
          )}

          {action.action_type === "assign_agent_random" && (() => {
            const usedIds = new Set(action.agent_distribution.map((d) => d.agent_id));
            const totalPercent = action.agent_distribution.reduce(
              (sum, d) => sum + (Number(d.percent) || 0),
              0
            );
            const availableToAdd = agents.filter((a) => !usedIds.has(a.id));

            return (
              <div className="flex flex-col gap-2">
                {agents.length === 0 && (
                  <p className="text-xs text-muted">No tienes agentes creados.</p>
                )}
                {action.agent_distribution.map((share, shareIndex) => (
                  <div key={shareIndex} className="flex items-center gap-2">
                    <select
                      value={share.agent_id}
                      onChange={(e) =>
                        updateAgentShare(index, shareIndex, { agent_id: e.target.value })
                      }
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                    >
                      {agents
                        .filter((a) => a.id === share.agent_id || !usedIds.has(a.id))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name ?? a.email}
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={share.percent}
                      onChange={(e) =>
                        updateAgentShare(index, shareIndex, {
                          percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                    />
                    <span className="text-xs text-muted">%</span>
                    <button
                      type="button"
                      onClick={() => removeAgentShare(index, shareIndex)}
                      className="text-muted hover:text-red-400"
                      title="Quitar agente"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}

                {availableToAdd.length > 0 && (
                  <button
                    type="button"
                    onClick={() => addAgentShare(index)}
                    className="flex items-center gap-1 self-start text-xs text-primary hover:underline"
                  >
                    <Plus size={12} />
                    Agregar agente
                  </button>
                )}

                <p
                  className={`text-[11px] ${
                    totalPercent === 100 ? "text-success" : "text-muted"
                  }`}
                >
                  Total: {totalPercent}%{" "}
                  {totalPercent !== 100 && "— se recomienda que sume 100% (se reparte proporcional si no)"}
                </p>
              </div>
            );
          })()}

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

          {showDelay && (
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
              <Clock size={13} className="shrink-0 text-muted" />
              <span className="text-xs text-muted">Esperar</span>
              <input
                type="number"
                min={0}
                value={action.delay_value}
                onChange={(e) =>
                  updateAction(index, { delay_value: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
              <select
                value={action.delay_unit}
                onChange={(e) => updateAction(index, { delay_unit: e.target.value as "seconds" | "minutes" })}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="seconds">segundos</option>
                <option value="minutes">minutos</option>
              </select>
              <span className="text-xs text-muted">antes de esta acción</span>
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
