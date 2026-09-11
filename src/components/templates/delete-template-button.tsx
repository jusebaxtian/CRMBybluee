"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTemplate } from "@/app/actions/templates";

export function DeleteTemplateButton({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await deleteTemplate(templateId);
    setPending(false);
    if (result && "error" in result) {
      setError(result.error ?? "Ocurrió un error.");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-red-400/40 bg-red-400/5 p-3">
        <p className="text-xs text-foreground">
          ¿Eliminar &quot;{templateName}&quot;? Se borra en Meta y no se puede deshacer.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {pending ? "Eliminando..." : "Sí, eliminar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:bg-surface-hover"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 text-xs text-muted hover:text-red-400"
    >
      <Trash2 size={12} />
      Eliminar
    </button>
  );
}
