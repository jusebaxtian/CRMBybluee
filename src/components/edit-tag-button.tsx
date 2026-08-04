"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { updateTag } from "@/app/actions/tags";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";

export function EditTagButton({
  tagId,
  tagName,
  tagColor,
}: {
  tagId: string;
  tagName: string;
  tagColor: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tagName);
  const [color, setColor] = useState(tagColor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function openEditor() {
    setName(tagName);
    setColor(tagColor);
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await updateTag(tagId, { name, color });
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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={popoverRef}
            className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg"
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
        </>
      )}
    </div>
  );
}
