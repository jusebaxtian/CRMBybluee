"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateTag } from "@/app/actions/tags";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";

export function EditTagButton({
  tagId,
  tagName,
  tagColor,
  excludesFollowups,
}: {
  tagId: string;
  tagName: string;
  tagColor: string;
  excludesFollowups: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tagName);
  const [color, setColor] = useState(tagColor);
  const [excludes, setExcludes] = useState(excludesFollowups);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    setName(tagName);
    setColor(tagColor);
    setExcludes(excludesFollowups);
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateTag(tagId, { name, color, excludesFollowups: excludes });
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openEditor}
        className="text-muted hover:text-foreground"
        title="Editar etiqueta"
      >
        <Pencil size={14} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-border bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="mb-1 block text-xs font-medium text-muted">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-3 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
            <label className="mb-1 block text-xs font-medium text-muted">Color</label>
            <div className="mb-3">
              <ColorSwatchPicker name="editColor" value={color} onChange={setColor} />
            </div>
            <label className="mb-3 flex items-start gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={excludes}
                onChange={(e) => setExcludes(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              Excluir de automatizaciones y seguimientos (ej: &quot;Ya compró&quot;, &quot;No interesados&quot;)
            </label>
            {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={pending || !name.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
