"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";
import { validateMediaSize, type MediaKind } from "@/lib/whatsapp/media-limits";
import { ACCION_DE_MEDIA, NOMBRE_MEDIA, type DatosBloque, type TipoMedia } from "@/lib/flujos/bloques";

// Los mismos tipos que acepta WhatsApp (ver media-limits.ts). El video puede venir
// en cualquier formato comun: el servidor lo convierte antes de guardarlo.
const ACEPTA =
  "image/jpeg,image/png,video/mp4,video/quicktime,video/webm,video/3gpp,.mov,.mkv,.avi,audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar";

function tipoDeArchivo(file: File): TipoMedia {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/") || /\.(mov|mkv|avi)$/i.test(file.name)) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

// XHR y no fetch: solo XHR informa el avance de la subida.
function subir(file: File, tipo: TipoMedia, alAvanzar: (porcentaje: number) => void): Promise<{ url: string; nombre: string } | { error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/automation-media");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve({ url: data.url, nombre: data.filename });
        else resolve({ error: data.error ?? "No se pudo subir el archivo." });
      } catch {
        resolve({ error: "No se pudo subir el archivo." });
      }
    };
    xhr.onerror = () => resolve({ error: "No se pudo subir el archivo. Revisa tu conexión." });
    const form = new FormData();
    form.set("file", file);
    form.set("actionType", ACCION_DE_MEDIA[tipo]);
    xhr.send(form);
  });
}

/** Archivo adjunto de un bloque Mensaje: imagen, video, audio o documento. */
export function AdjuntoDelBloque({ datos, onCambiar }: { datos: DatosBloque; onCambiar: (datos: DatosBloque) => void }) {
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tiene = !!datos.mediaUrl && !!datos.mediaTipo;

  async function elegido(file: File) {
    setError(null);
    const tipo = tipoDeArchivo(file);
    // El video se mide despues de convertirlo, en el servidor; lo demas se corta antes de subir.
    if (tipo !== "video") {
      const exceso = validateMediaSize(tipo as MediaKind, file.size);
      if (exceso) {
        setError(exceso);
        return;
      }
    }
    setProgreso(0);
    const r = await subir(file, tipo, setProgreso);
    setProgreso(null);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    onCambiar({ ...datos, mediaTipo: tipo, mediaUrl: r.url, mediaNombre: r.nombre });
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">Archivo adjunto (opcional)</label>
      {!tiene && progreso === null && (
        <input
          type="file"
          accept={ACEPTA}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void elegido(f);
            e.target.value = "";
          }}
          className="w-full text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-primary-hover"
        />
      )}

      {progreso !== null && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${progreso}%` }} />
          </div>
          <p className="text-xs text-muted">Subiendo archivo… {progreso}%</p>
        </div>
      )}

      {tiene && progreso === null && datos.mediaTipo && datos.mediaUrl && (
        <div className="flex items-start gap-2 rounded-[9px] border border-border bg-background p-2">
          <div className="min-w-0 flex-1">
            {datos.mediaTipo === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={datos.mediaUrl} alt={datos.mediaNombre || "Imagen"} className="h-24 w-24 rounded-md object-cover" />
            )}
            {datos.mediaTipo === "video" && <video src={datos.mediaUrl} controls playsInline className="max-h-36 w-full rounded-md bg-black" />}
            {datos.mediaTipo === "audio" && <audio src={datos.mediaUrl} controls className="w-full" />}
            {datos.mediaTipo === "document" && (
              <a href={datos.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                <FileText size={16} className="shrink-0" />
                <span className="truncate">{datos.mediaNombre || "Ver documento"}</span>
              </a>
            )}
            <p className="mt-1 truncate text-[11px] text-success">
              ✓ {NOMBRE_MEDIA[datos.mediaTipo]}
              {datos.mediaNombre ? `: ${datos.mediaNombre}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCambiar({ ...datos, mediaTipo: undefined, mediaUrl: undefined, mediaNombre: undefined })}
            title="Quitar archivo"
            className="shrink-0 text-muted hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-[11.5px] text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        {datos.mediaTipo === "audio"
          ? "El audio no admite texto en WhatsApp: si escribes un mensaje, sale justo después como un texto aparte."
          : "Si escribes un mensaje, acompaña al archivo como pie. Imagen JPG o PNG, video, audio o documento (PDF, Word, Excel…)."}
      </p>
    </div>
  );
}
