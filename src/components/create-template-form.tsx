"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const headerAccept: Record<string, string> = {
  image: "image/jpeg,image/png",
  video: "video/mp4,video/quicktime",
  document: "application/pdf",
};

type TemplateButton = { type: "URL" | "QUICK_REPLY"; text: string; url: string };

function submitWithProgress(
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<{ success?: boolean; error?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/create-template");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        reject(new Error("Respuesta inválida del servidor."));
      }
    };
    xhr.onerror = () => reject(new Error("Error de red al enviar la plantilla."));
    xhr.send(formData);
  });
}

export function CreateTemplateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("UTILITY");
  const [language, setLanguage] = useState("es");
  const [bodyText, setBodyText] = useState("");
  const [headerKind, setHeaderKind] = useState<"none" | "text" | "image" | "video" | "document">(
    "none"
  );
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const urlButtonCount = buttons.filter((b) => b.type === "URL").length;

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setUploading(true);
    setProgress(0);

    const formData = new FormData(e.currentTarget);
    formData.set("buttonsJson", JSON.stringify(buttons));

    try {
      const result = await submitWithProgress(formData, setProgress);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setName("");
        setCategory("UTILITY");
        setLanguage("es");
        setBodyText("");
        setHeaderKind("none");
        setHeaderText("");
        setFooterText("");
        setButtons([]);
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la plantilla.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
            Nombre (interno)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="promo_verano"
            pattern="[a-z0-9_]+"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted">minúsculas, números y _</p>
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-muted">
            Categoría
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="UTILITY">Utilidad</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Autenticación</option>
          </select>
        </div>
        <div>
          <label htmlFor="language" className="mb-1 block text-sm font-medium text-muted">
            Idioma
          </label>
          <select
            id="language"
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="es">Español</option>
            <option value="es_CO">Español (Colombia)</option>
            <option value="en_US">Inglés (EE.UU.)</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="headerKind" className="mb-1 block text-sm font-medium text-muted">
          Encabezado (opcional)
        </label>
        <select
          id="headerKind"
          name="headerKind"
          value={headerKind}
          onChange={(e) => setHeaderKind(e.target.value as typeof headerKind)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="none">Sin encabezado</option>
          <option value="text">Texto</option>
          <option value="image">Imagen</option>
          <option value="video">Video</option>
          <option value="document">Documento</option>
        </select>
        <p className="mt-1 text-xs text-muted">
          El audio no está permitido como encabezado de plantilla — es una limitación de WhatsApp, no del CRM.
        </p>

        {headerKind === "text" && (
          <input
            name="headerText"
            type="text"
            maxLength={60}
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder="Texto del encabezado"
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        )}

        {["image", "video", "document"].includes(headerKind) && (
          <div className="mt-2">
            <input
              name="headerFile"
              type="file"
              accept={headerAccept[headerKind]}
              className="w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-xs file:text-foreground"
            />
            <p className="mt-1 text-xs text-muted">
              Este archivo se usa como ejemplo para que Meta apruebe la plantilla, y también es el
              que se envía cada vez que la uses.
            </p>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="bodyText" className="mb-1 block text-sm font-medium text-muted">
          Cuerpo del mensaje
        </label>
        <textarea
          id="bodyText"
          name="bodyText"
          required
          rows={4}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="Hola {{1}}, tenemos una promoción especial para ti..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <p className="mt-1 text-xs text-muted">
          Usa {"{{1}}"}, {"{{2}}"}, etc. para variables (ej. nombre del contacto).
        </p>
      </div>

      <div>
        <label htmlFor="footerText" className="mb-1 block text-sm font-medium text-muted">
          Pie de página (opcional)
        </label>
        <input
          id="footerText"
          name="footerText"
          type="text"
          maxLength={60}
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-muted">Botones (opcional)</label>
        <input type="hidden" name="buttonsJson" value={JSON.stringify(buttons)} />
        <div className="flex flex-col gap-2">
          {buttons.map((btn, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
              <div className="flex items-center gap-1.5">
                <select
                  value={btn.type}
                  onChange={(e) => {
                    const type = e.target.value as TemplateButton["type"];
                    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, type } : b)));
                  }}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                >
                  <option value="QUICK_REPLY">Respuesta rápida</option>
                  <option value="URL" disabled={urlButtonCount >= 2 && btn.type !== "URL"}>
                    Ir a un sitio web
                  </option>
                </select>
                <input
                  type="text"
                  value={btn.text}
                  onChange={(e) => {
                    const text = e.target.value.slice(0, 20);
                    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, text } : b)));
                  }}
                  maxLength={20}
                  placeholder="Texto del botón"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setButtons((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-muted hover:text-red-400"
                  title="Quitar botón"
                >
                  <X size={14} />
                </button>
              </div>
              {btn.type === "URL" && (
                <input
                  type="text"
                  value={btn.url}
                  onChange={(e) => {
                    const url = e.target.value;
                    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, url } : b)));
                  }}
                  placeholder="https://tusitio.com/{{1}} (el {{1}} es opcional, se rellena con el nombre)"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
              )}
              {btn.type === "URL" && btn.url.trim() && !/^https?:\/\//i.test(btn.url.trim()) && (
                <p className="text-xs text-red-400">La URL debe empezar con https:// o http://</p>
              )}
            </div>
          ))}
          {buttons.length < 3 && (
            <button
              type="button"
              onClick={() => setButtons((prev) => [...prev, { type: "QUICK_REPLY", text: "", url: "" }])}
              className="flex w-fit items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus size={12} />
              Agregar botón (hasta 3, máx. 2 de tipo URL)
            </button>
          )}
        </div>
      </div>

      {uploading && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {progress < 100 ? `Subiendo archivo... ${progress}%` : "Procesando en Meta..."}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 size={14} />
          Plantilla enviada a Meta para aprobación. Puede tardar minutos u horas en revisarse.
        </p>
      )}

      <Button type="submit" disabled={uploading} className="self-start">
        {uploading ? "Enviando a Meta..." : "Enviar plantilla a aprobación"}
      </Button>
    </form>
  );
}
