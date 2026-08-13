"use client";

import { useActionState, useEffect, useState } from "react";
import { Info, Users } from "lucide-react";
import { createCampaign, updateCampaign, uploadCampaignMedia, previewAudienceCount } from "@/app/actions/campaigns";

type Template = { id: string; meta_template_name: string; status: string };
type Tag = { id: string; name: string; excludes_followups: boolean };
type SendType = "template" | "free_text";
type MediaKind = "" | "image" | "video" | "audio" | "document";

const mediaAccept: Record<Exclude<MediaKind, "">, string> = {
  image: "image/jpeg,image/png",
  video: "video/mp4,video/quicktime,video/webm,video/3gpp,.mov,.mkv,.avi",
  audio: "audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,.mp3,.m4a,.ogg,.amr",
  document: "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
};

export type CampaignInitialValues = {
  name: string;
  sendType: SendType;
  templateId: string | null;
  messageBody: string | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  includeTagIds: string[];
  excludeTagIds: string[];
  createdFrom: string | null;
  createdTo: string | null;
  audienceWindow: "all" | "open";
  scheduledAt: string | null; // ISO
};

// Local (browser) datetime for a <input type="datetime-local"> from an ISO string.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewCampaignForm({
  templates,
  tags,
  mode = "create",
  campaignId,
  initialValues,
}: {
  templates: Template[];
  tags: Tag[];
  mode?: "create" | "edit";
  campaignId?: string;
  initialValues?: CampaignInitialValues;
}) {
  const boundAction = mode === "edit" && campaignId ? updateCampaign.bind(null, campaignId) : createCampaign;
  const [state, action, pending] = useActionState(boundAction, undefined);

  const [sendType, setSendType] = useState<SendType>(initialValues?.sendType ?? "template");
  const [mediaKind, setMediaKind] = useState<MediaKind>("");
  const [mediaUrl, setMediaUrl] = useState(initialValues?.mediaUrl ?? "");
  const [mediaFilename, setMediaFilename] = useState(initialValues?.mediaFilename ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [includeTagIds, setIncludeTagIds] = useState<string[]>(initialValues?.includeTagIds ?? []);
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>(initialValues?.excludeTagIds ?? []);
  const [createdFrom, setCreatedFrom] = useState(initialValues?.createdFrom ?? "");
  const [createdTo, setCreatedTo] = useState(initialValues?.createdTo ?? "");
  const [windowOnly, setWindowOnly] = useState(initialValues?.audienceWindow === "open");
  const [sendMode, setSendMode] = useState<"now" | "schedule">(initialValues?.scheduledAt ? "schedule" : "now");
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(initialValues?.scheduledAt ?? null));

  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  function toggleTag(list: string[], setList: (ids: string[]) => void, tagId: string) {
    setList(list.includes(tagId) ? list.filter((id) => id !== tagId) : [...list, tagId]);
  }

  // Live recipient counter — recomputes whenever any audience filter
  // changes, using the exact same resolution logic the real send uses.
  useEffect(() => {
    const formData = new FormData();
    formData.set("sendType", sendType);
    includeTagIds.forEach((id) => formData.append("includeTagIds", id));
    excludeTagIds.forEach((id) => formData.append("excludeTagIds", id));
    if (createdFrom) formData.set("createdFrom", createdFrom);
    if (createdTo) formData.set("createdTo", createdTo);
    if (sendType === "template" && windowOnly) formData.set("audienceWindow", "open");

    setCountLoading(true);
    const timeout = setTimeout(() => {
      previewAudienceCount(formData)
        .then((result) => setAudienceCount("count" in result && typeof result.count === "number" ? result.count : null))
        .finally(() => setCountLoading(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [sendType, includeTagIds, excludeTagIds, createdFrom, createdTo, windowOnly]);

  async function handleFile(file: File, kind: Exclude<MediaKind, "">) {
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("mediaKind", kind);
    const result = await uploadCampaignMedia(formData);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error ?? "No se pudo subir el archivo.");
      return;
    }
    setMediaUrl(result.url);
    setMediaFilename(result.filename);
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="sendType" value={sendType} />
      <input type="hidden" name="mediaUrl" value={mediaUrl} />
      <input type="hidden" name="mediaFilename" value={mediaFilename} />
      <input type="hidden" name="sendMode" value={sendMode} />

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
          Nombre de la campaña
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={initialValues?.name ?? ""}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Tipo de envío</label>
        <select
          value={sendType}
          onChange={(e) => setSendType(e.target.value as SendType)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="template">Plantilla aprobada</option>
          <option value="free_text">Mensaje libre (sin plantilla)</option>
        </select>
      </div>

      {sendType === "template" ? (
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
              defaultValue={initialValues?.templateId ?? undefined}
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
      ) : (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-1.5 rounded-lg border border-border bg-background p-3 text-xs text-muted">
            <Info size={13} className="mt-0.5 shrink-0" />
            Solo se enviará a contactos con la ventana de 24h abierta (los que te escribieron
            recientemente) — WhatsApp no permite mensaje libre fuera de esa ventana.
          </p>
          <textarea
            name="messageBody"
            rows={3}
            placeholder="Escribe el mensaje..."
            defaultValue={initialValues?.messageBody ?? ""}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Adjuntar archivo (opcional)
            </label>
            <select
              value={mediaKind}
              onChange={(e) => {
                setMediaKind(e.target.value as MediaKind);
                setMediaUrl("");
                setMediaFilename("");
              }}
              className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">Ninguno</option>
              <option value="image">Imagen</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="document">Documento</option>
            </select>
            {mediaKind && (
              <input
                type="file"
                accept={mediaAccept[mediaKind]}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file, mediaKind);
                }}
                className="text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-hover"
              />
            )}
            {uploading && <p className="mt-1 text-xs text-muted">Subiendo archivo...</p>}
            {mediaUrl && !uploading && (
              <p className="mt-1 text-xs text-success">✓ {mediaFilename || "Archivo listo"}</p>
            )}
            {uploadError && <p className="mt-1 text-xs text-red-400">{uploadError}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium text-foreground">Audiencia</p>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Incluir por etiqueta (vacío = todos los contactos)
          </label>
          {tags.length === 0 ? (
            <p className="text-xs text-muted">No tienes etiquetas creadas.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const active = includeTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(includeTagIds, setIncludeTagIds, t.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted hover:bg-surface-hover"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
          {includeTagIds.map((id) => (
            <input key={id} type="hidden" name="includeTagIds" value={id} />
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Excluir por etiqueta (gana sobre la inclusión si un contacto tiene ambas)
          </label>
          {tags.length === 0 ? (
            <p className="text-xs text-muted">No tienes etiquetas creadas.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const active = excludeTagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(excludeTagIds, setExcludeTagIds, t.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      active
                        ? "border-red-400 bg-red-400/10 text-red-400"
                        : "border-border text-muted hover:bg-surface-hover"
                    }`}
                  >
                    {t.excludes_followups ? `${t.name} (sin seguimientos)` : t.name}
                  </button>
                );
              })}
            </div>
          )}
          {excludeTagIds.map((id) => (
            <input key={id} type="hidden" name="excludeTagIds" value={id} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="createdFrom" className="mb-1 block text-xs font-medium text-muted">
              Creados desde
            </label>
            <input
              id="createdFrom"
              name="createdFrom"
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="createdTo" className="mb-1 block text-xs font-medium text-muted">
              Creados hasta
            </label>
            <input
              id="createdTo"
              name="createdTo"
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        {sendType === "template" && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={windowOnly}
              onChange={(e) => setWindowOnly(e.target.checked)}
              className="accent-primary"
            />
            Enviar solo a contactos con la ventana de 24h abierta
          </label>
        )}
        {sendType === "template" && windowOnly && (
          <input type="hidden" name="audienceWindow" value="open" />
        )}

        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <Users size={15} className="shrink-0 text-primary" />
          <span className="text-foreground">
            {countLoading
              ? "Calculando..."
              : audienceCount === null
                ? "—"
                : `Se enviará a ${audienceCount} contacto${audienceCount === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <p className="text-sm font-medium text-foreground">Envío</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSendMode("now")}
            className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
              sendMode === "now"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:bg-surface-hover"
            }`}
          >
            Envío inmediato
          </button>
          <button
            type="button"
            onClick={() => setSendMode("schedule")}
            className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium ${
              sendMode === "schedule"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:bg-surface-hover"
            }`}
          >
            Programar envío
          </button>
        </div>
        {sendMode === "now" ? (
          <p className="text-xs text-muted">
            La campaña queda en borrador — la envías cuando quieras con el botón &quot;Enviar&quot;.
          </p>
        ) : (
          <div>
            <label htmlFor="scheduledAt" className="mb-1 block text-xs font-medium text-muted">
              Fecha y hora de envío
            </label>
            <input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={toLocalInputValue(new Date().toISOString())}
              required={sendMode === "schedule"}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted">
              Se enviará sola a esa hora, sin que tengas que volver a entrar.
            </p>
          </div>
        )}
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || uploading || (sendType === "template" && templates.length === 0)}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear campaña"}
      </button>
    </form>
  );
}
