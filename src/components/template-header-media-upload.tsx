"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Upload } from "lucide-react";
import { setTemplateHeaderMedia } from "@/app/actions/templates";

const accept: Record<string, string> = {
  IMAGE: "image/jpeg,image/png",
  VIDEO: "video/mp4,video/quicktime",
  DOCUMENT: "application/pdf",
};

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await setTemplateHeaderMedia(templateId, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-md border border-warning/50 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
      >
        <Upload size={12} />
        {pending ? "Subiendo..." : "Subir archivo del encabezado"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
