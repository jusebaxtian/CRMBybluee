"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importContactsCsv } from "@/app/actions/contacts";

export function ImportContactsButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPending(true);
    setMessage(null);
    const text = await file.text();
    const result = await importContactsCsv(text);
    setPending(false);
    e.target.value = "";

    if ("error" in result) {
      setMessage(result.error ?? "Error al importar.");
    } else {
      setMessage(`${result.count} contacto(s) importado(s).`);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
      >
        <Upload size={14} />
        {pending ? "Importando..." : "Importar CSV"}
      </button>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
