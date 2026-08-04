"use client";

import { useActionState, useState } from "react";
import { createTag } from "@/app/actions/tags";
import { ColorSwatchPicker, TAG_COLORS } from "@/components/color-swatch-picker";

export function CreateTagForm() {
  const [state, action, pending] = useActionState(createTag, undefined);
  const [color, setColor] = useState(TAG_COLORS[0]);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input
        name="name"
        type="text"
        placeholder="Nombre de la etiqueta"
        required
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <ColorSwatchPicker name="color" value={color} onChange={setColor} />
      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" name="excludesFollowups" className="accent-primary" />
        Excluir de automatizaciones y seguimientos (ej: &quot;Ya compró&quot;, &quot;No interesados&quot;)
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Creando..." : "Crear etiqueta"}
      </button>
      {state && "error" in state && (
        <p className="w-full text-sm text-red-400">{state.error}</p>
      )}
    </form>
  );
}
