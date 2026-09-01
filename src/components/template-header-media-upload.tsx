"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";

const accept: Record<string, string> = {
  IMAGE: "image/jpeg,image/png",
  VIDEO: "video/mp4,video/quicktime",
  DOCUMENT: "application/pdf",
};

function uploadWithProgress(
  templateId: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<{ success?: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/template-header-media");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(
          new Error(
            xhr.status === 413
              ? "El archivo es demasiado grande para subir."
              : "El servidor no pudo procesar el archivo. Intenta de nuevo o con otro archivo."
          )
        );
      }
    };
    xhr.onerror = () => reject(new Error("Error de red al subir el archivo."));
    const formData = new FormData();
    formData.set("templateId", templateId);
    formData.set("file", file);
    xhr.send(formData);
  });
}

// Shown on a template synced from Meta that has an IMAGE/VIDEO/DOCUMENT
// header but no local file for it yet — every send fails until this is
// filled in (Meta's sync response has no reusable URL for the header).
export function TemplateHeaderMediaUpload({
  templateId,
  headerFormat,
}: {
  templateId: string;
  headerFormat: "IMAGE" | "VIDEO" | "DOCUMENT";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setProgress(0);
    setError(null);
    setDone(false);
    try {
      const result = await uploadWithProgress(templateId, file, setProgress);
      if (result?.error) {
        setError(result.error);
      } else {
        setDone(true);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-xs text-success">
        <CheckCircle2 size={14} className="shrink-0" />
        Archivo subido correctamente.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
      <div className="mb-2 flex items-start gap-2 text-xs text-warning">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Esta plantilla se sincronizó desde Meta con un encabezado de{" "}
          {headerFormat === "IMAGE" ? "imagen" : headerFormat === "VIDEO" ? "video" : "documento"}, pero
          falta el archivo — los envíos van a fallar hasta que lo subas.
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept[headerFormat]}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {uploading ? (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted">Subiendo archivo... {progress}%</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md border border-warning/50 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
        >
          <Upload size={12} />
          Subir archivo del encabezado
        </button>
      )}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
