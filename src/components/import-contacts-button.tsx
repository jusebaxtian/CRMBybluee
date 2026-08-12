"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Info, X } from "lucide-react";
import { importContactsFile } from "@/app/actions/contacts";

export function ImportContactsButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPending(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData();
    formData.append("file", file);
    const result = await importContactsFile(formData);
    setPending(false);
    e.target.value = "";

    if ("error" in result) {
      setIsError(true);
      setMessage(result.error ?? "Error al importar.");
    } else {
      setIsError(false);
      const skippedText = result.skipped ? ` (${result.skipped} fila(s) sin celular válido se omitieron)` : "";
      setMessage(`${result.count} contacto(s) importado(s)${skippedText}.`);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          disabled={pending}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          <Upload size={14} />
          {pending ? "Importando..." : "Importar Excel"}
        </button>
        <a
          href="/api/contacts/import-template"
          download
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover"
        >
          <Download size={14} />
          Descargar plantilla
        </a>
      </div>

      {message && (
        <p className={`text-sm ${isError ? "text-red-400" : "text-muted"}`}>{message}</p>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-primary" />
                <h3 className="text-base font-semibold text-foreground">Cómo cargar tu archivo</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="text-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                <span className="font-medium text-foreground">Celular</span> — obligatoria. Va con o sin código de
                país, con o sin &quot;+&quot; o espacios: el sistema lo ajusta solo. Si escribes un celular
                colombiano de 10 dígitos (empieza en 3), se le agrega automáticamente el 57. No se aceptan usuarios
                ni enlaces de WhatsApp, solo el número.
              </li>
              <li>
                <span className="font-medium text-foreground">Nombre</span> — opcional.
              </li>
              <li>
                <span className="font-medium text-foreground">Etiquetas</span> — opcional. Varias separadas por
                coma; si no existen, se crean solas.
              </li>
              <li>La fecha de creación se toma sola: es el momento en que subes el archivo.</li>
              <li>Si un celular ya existe en tu cuenta, se actualiza en vez de duplicarse.</li>
              <li>Formatos aceptados: Excel (.xlsx) o CSV.</li>
            </ul>

            <div className="mt-5 flex items-center justify-between gap-3">
              <a
                href="/api/contacts/import-template"
                download
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Download size={14} />
                Descargar plantilla
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowHelp(false);
                  inputRef.current?.click();
                }}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <Upload size={14} />
                Elegir archivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
