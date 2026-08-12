"use client";

import { useActionState, useState } from "react";
import { Info } from "lucide-react";
import { createCampaign, uploadCampaignMedia } from "@/app/actions/campaigns";

type Template = { id: string; meta_template_name: string; status: string };
type Tag = { id: string; name: string; excludes_followups: boolean };
type SendType = "template" | "free_text";
type MediaKind = "" | "image" | "video" | "document";

const mediaAccept: Record<Exclude<MediaKind, "">, string> = {
  image: "image/jpeg,image/png",
  video: "video/mp4,video/quicktime,video/webm,video/3gpp,.mov,.mkv,.avi",
  document: "application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt",
};

export function NewCampaignForm({
  templates,
  tags,
}: {
  templates: Template[];
  tags: Tag[];
}) {
  const [state, action, pending] = useActionState(createCampaign, undefined);
  const [sendType, setSendType] = useState<SendType>("template");
  const [mediaKind, setMediaKind] = useState<MediaKind>("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFilename, setMediaFilename] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [includeTagIds, setIncludeTagIds] = useState<string[]>([]);
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>([]);

  function toggleTag(list: string[], setList: (ids: string[]) => void, tagId: string) {
    setList(list.includes(tagId) ? list.filter((id) => id !== tagId) : [...list, tagId]);
  }

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
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {sendType === "template" && (
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" name="audienceWindow" value="open" className="accent-primary" />
          Enviar solo a contactos con la ventana de 24h abierta
        </label>
      )}

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || uploading || (sendType === "template" && templates.length === 0)}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Creando..." : "Crear campaña"}
      </button>
    </form>
  );
}
