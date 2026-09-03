"use client";

import { useState } from "react";
import { Trash2, Plus, Info, ChevronUp, ChevronDown, Clock, X, FileText } from "lucide-react";
import { validateMediaSize, type MediaKind } from "@/lib/whatsapp/media-limits";

const mediaKindByActionType: Record<string, MediaKind> = {
  send_image: "image",
  send_video: "video",
  send_audio: "audio",
  send_document: "document",
};

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
type QuickReply = { id: string; name: string };

type ActionType =
  | "send_message"
  | "add_tag"
  | "send_image"
  | "send_video"
  | "send_audio"
  | "send_document"
  | "send_template"
  | "send_quick_reply"
  | "assign_agent"
  | "assign_agent_random"
  | "wait_for_reply";

type AgentShare = { agent_id: string; percent: number };

type ActionRow = {
  action_type: ActionType;
  message_body: string;
  tag_id: string;
  media_url: string;
  media_filename: string;
  template_id: string;
  quick_reply_id: string;
  target_agent_id: string;
  agent_distribution: AgentShare[];
  delay_value: number;
  delay_unit: "seconds" | "minutes" | "hours" | "days";
  buttons: ButtonRow[];
};

// WhatsApp doesn't allow mixing reply buttons with a URL button in the same
// message — a "send_message" action carries either up to 3 QUICK_REPLY
// buttons or exactly one URL button, never both.
type ButtonRow = { type: "QUICK_REPLY"; id: string; title: string } | { type: "URL"; title: string; url: string };

export type InitialAction = {
  action_type: ActionType;
  message_body: string | null;
  tag_id: string | null;
  media_url?: string | null;
  media_filename?: string | null;
  template_id?: string | null;
  quick_reply_id?: string | null;
  target_agent_id?: string | null;
  agent_distribution?: AgentShare[] | null;
  delay_seconds?: number | null;
  buttons?: ButtonRow[] | null;
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
  // Broader than what WhatsApp accepts — every video gets normalized to
  // H.264/AAC server-side (see video-transcode.ts), so any common format
  // (including iPhone's .mov/HEVC) is fine to pick here.
  send_video: "video/mp4,video/quicktime,video/webm,video/3gpp,.mov,.mkv,.avi",
  send_audio: "audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg",
  send_document: "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar",
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
    quick_reply_id: "",
    target_agent_id: "",
    agent_distribution: [],
    delay_value: 0,
    delay_unit: "seconds",
    buttons: [],
  };
}

function toDelayValueUnit(
  seconds: number | null | undefined
): { value: number; unit: "seconds" | "minutes" | "hours" | "days" } {
  const s = seconds ?? 0;
  if (s > 0 && s % 86400 === 0) return { value: s / 86400, unit: "days" };
  if (s > 0 && s % 3600 === 0) return { value: s / 3600, unit: "hours" };
  if (s > 0 && s % 60 === 0) return { value: s / 60, unit: "minutes" };
  return { value: s, unit: "seconds" };
}

const delaySecondsPerUnit: Record<"seconds" | "minutes" | "hours" | "days", number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

// WhatsApp allows either up to 3 quick-reply buttons OR exactly one URL
// button on a session message — never both — so this is a mode switch, not
// a free-form list. "Cuando se toca un botón" automations match a quick-
// reply button's exact text; a URL button just opens the link, no webhook.
function BottomButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: ButtonRow[];
  onChange: (buttons: ButtonRow[]) => void;
}) {
  const mode: "none" | "QUICK_REPLY" | "URL" = buttons[0]?.type ?? "none";

  function setMode(next: "none" | "QUICK_REPLY" | "URL") {
    if (next === "none") onChange([]);
    else if (next === "QUICK_REPLY") onChange([{ type: "QUICK_REPLY", id: "", title: "" }]);
    else onChange([{ type: "URL", title: "", url: "" }]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as "none" | "QUICK_REPLY" | "URL")}
        className="w-fit rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
      >
        <option value="none">Sin botones</option>
        <option value="QUICK_REPLY">Botones de respuesta rápida (hasta 3)</option>
        <option value="URL">Botón de enlace (URL, uno solo)</option>
      </select>

      {mode === "QUICK_REPLY" && (
        <>
          {buttons.map((btn, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="text"
                value={btn.title}
                onChange={(e) => {
                  // The id IS the title — WhatsApp's own quick-reply
                  // buttons default their payload to the button text too,
                  // so a "Cuando se toca un botón" automation can match by
                  // that same exact text, no separate id field to keep in sync.
                  const title = e.target.value.slice(0, 20);
                  onChange(buttons.map((b, idx) => (idx === i ? { type: "QUICK_REPLY", id: title, title } : b)));
                }}
                maxLength={20}
                placeholder={`Botón ${i + 1} (ej: Sí, me interesa)`}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => onChange(buttons.filter((_, idx) => idx !== i))}
                className="shrink-0 text-muted hover:text-red-400"
                title="Quitar botón"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {buttons.length < 3 && (
            <button
              type="button"
              onClick={() => onChange([...buttons, { type: "QUICK_REPLY", id: "", title: "" }])}
              className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus size={12} />
              Agregar otro botón
            </button>
          )}
          <p className="text-[11px] text-muted">
            Cuando el contacto toque un botón, crea una automatización con el disparador &quot;Cuando se toca
            un botón&quot; usando ese mismo texto para reaccionar al clic.
          </p>
        </>
      )}

      {mode === "URL" && buttons[0]?.type === "URL" && (() => {
        const urlButton = buttons[0];
        return (
          <>
            <input
              type="text"
              value={urlButton.title}
              onChange={(e) =>
                onChange([{ type: "URL", title: e.target.value.slice(0, 20), url: urlButton.url }])
              }
              maxLength={20}
              placeholder="Texto del botón (ej: Ver catálogo)"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <input
              type="text"
              value={urlButton.url}
              onChange={(e) => onChange([{ type: "URL", title: urlButton.title, url: e.target.value }])}
              placeholder="https://tusitio.com/pagina"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted">
              Al tocarlo, el contacto va directo a esa página — no dispara ninguna automatización.
            </p>
          </>
        );
      })()}
    </div>
  );
}

export function AutomationActionsBuilder({
  tags,
  templates = [],
  agents = [],
  quickReplies = [],
  initialActions,
  hideAgentActions = false,
  showDelay = true,
  allowWaitForReply = false,
  onUploadingChange,
}: {
  tags: Tag[];
  templates?: Template[];
  agents?: Agent[];
  quickReplies?: QuickReply[];
  initialActions?: InitialAction[];
  hideAgentActions?: boolean;
  showDelay?: boolean;
  allowWaitForReply?: boolean;
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
            quick_reply_id: a.quick_reply_id ?? quickReplies[0]?.id ?? "",
            target_agent_id: a.target_agent_id ?? agents[0]?.id ?? "",
            agent_distribution: a.agent_distribution ?? [],
            delay_value: value,
            delay_unit: unit,
            buttons: a.buttons ?? [],
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
    setUploadError(null);
    // Catch an oversized file before spending an upload on it — except
    // video, which the server transcodes/compresses first, so its real
    // size is only known (and checked) after that happens.
    const actionType = actions[index].action_type;
    const mediaKind = mediaKindByActionType[actionType];
    if (mediaKind && mediaKind !== "video") {
      const sizeError = validateMediaSize(mediaKind, file.size);
      if (sizeError) {
        setUploadError(sizeError);
        return;
      }
    }
    setUploadingIndex(index);
    setUploadProgress(0);
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
    quick_reply_id: a.action_type === "send_quick_reply" ? a.quick_reply_id : undefined,
    target_agent_id: a.action_type === "assign_agent" ? a.target_agent_id : undefined,
    agent_distribution: a.action_type === "assign_agent_random" ? a.agent_distribution : undefined,
    delay_seconds:
      a.action_type !== "wait_for_reply" && a.delay_value > 0
        ? a.delay_value * delaySecondsPerUnit[a.delay_unit]
        : 0,
    buttons: a.action_type === "send_message" ? a.buttons.filter((b) => b.title.trim()) : undefined,
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
              onChange={(e) => {
                const nextType = e.target.value as ActionType;
                // The <select> visually shows its first <option> whenever
                // the bound value doesn't match any option (e.g. still the
                // empty-string default) — but that's just native <select>
                // fallback rendering, the actual state stays empty unless
                // set explicitly, which silently drops the field on submit.
                const patch: Partial<ActionRow> = { action_type: nextType };
                if (nextType === "send_quick_reply" && !action.quick_reply_id) {
                  patch.quick_reply_id = quickReplies[0]?.id ?? "";
                }
                if (nextType === "send_template" && !action.template_id) {
                  patch.template_id = approvedTemplates[0]?.id ?? "";
                }
                updateAction(index, patch);
              }}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="send_message">Enviar mensaje de texto</option>
              <option value="send_image">Enviar imagen</option>
              <option value="send_video">Enviar video</option>
              <option value="send_audio">Enviar audio / nota de voz</option>
              <option value="send_document">Enviar documento</option>
              <option value="send_template">Enviar plantilla aprobada</option>
              {quickReplies.length > 0 && (
                <option value="send_quick_reply">Enviar respuesta rápida</option>
              )}
              <option value="add_tag">Agregar etiqueta</option>
              {allowWaitForReply && (
                <option value="wait_for_reply">Esperar respuesta del cliente</option>
              )}
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
            <div className="flex flex-col gap-1.5">
              <textarea
                value={action.message_body}
                onChange={(e) => updateAction(index, { message_body: e.target.value })}
                rows={2}
                placeholder="Mensaje a enviar... usa {{nombre}} para el nombre del contacto"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
              <p className="text-[11px] text-muted">
                Escribe <code className="rounded bg-surface-hover px-1">{"{{nombre}}"}</code> donde quieras que
                aparezca el nombre del contacto.
              </p>

              <BottomButtonsEditor
                buttons={action.buttons}
                onChange={(buttons) => updateAction(index, { buttons })}
              />
            </div>
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
                <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
                  <div className="min-w-0 flex-1">
                    {action.action_type === "send_image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={action.media_url}
                        alt={action.media_filename || "Imagen cargada"}
                        className="h-28 w-28 rounded-md object-cover"
                      />
                    )}
                    {action.action_type === "send_video" && (
                      <video
                        src={action.media_url}
                        controls
                        playsInline
                        className="max-h-40 w-full max-w-xs rounded-md bg-black"
                      />
                    )}
                    {action.action_type === "send_audio" && (
                      <audio src={action.media_url} controls className="w-full max-w-xs" />
                    )}
                    {action.action_type === "send_document" && (
                      <a
                        href={action.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <FileText size={16} className="shrink-0" />
                        <span className="truncate">{action.media_filename || "Ver documento"}</span>
                      </a>
                    )}
                    <p className="mt-1 truncate text-[11px] text-success">
                      ✓ {action.media_filename || "Archivo listo"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateAction(index, { media_url: "", media_filename: "" })}
                    title="Quitar archivo"
                    className="shrink-0 text-muted hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
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

          {action.action_type === "send_quick_reply" && (
            <div className="flex flex-col gap-2">
              <select
                value={action.quick_reply_id}
                onChange={(e) => updateAction(index, { quick_reply_id: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {quickReplies.length === 0 && <option value="">No tienes respuestas rápidas</option>}
                {quickReplies.map((qr) => (
                  <option key={qr.id} value={qr.id}>
                    {qr.name}
                  </option>
                ))}
              </select>
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <Info size={13} className="mt-0.5 shrink-0" />
                Ejecuta todas las acciones de esa respuesta rápida, en orden, como parte de esta
                automatización.
              </p>
            </div>
          )}

          {action.action_type === "wait_for_reply" && (
            <p className="flex items-start gap-1.5 text-[11px] text-muted">
              <Info size={13} className="mt-0.5 shrink-0" />
              La automatización se detiene aquí hasta que el cliente escriba algo — no importa qué
              responda, en cuanto conteste continúa con el siguiente paso. Si nunca responde, se
              queda esperando indefinidamente en este punto.
            </p>
          )}

          {showDelay && action.action_type !== "wait_for_reply" && (
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
                onChange={(e) =>
                  updateAction(index, {
                    delay_unit: e.target.value as "seconds" | "minutes" | "hours" | "days",
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="seconds">segundos</option>
                <option value="minutes">minutos</option>
                <option value="hours">horas</option>
                <option value="days">días</option>
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
