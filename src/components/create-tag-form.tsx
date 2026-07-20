"use client";

import { useActionState } from "react";
import { createTag } from "@/app/actions/tags";

const COLORS = ["#1ba84a", "#7c5cff", "#22c55e", "#eab308", "#ef4444", "#3b82f6", "#ec4899"];

export function CreateTagForm() {
  const [state, action, pending] = useActionState(createTag, undefined);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        type="text"
        placeholder="Nombre de la etiqueta"
        required
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <select
        name="color"
        defaultValue={COLORS[0]}
        className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
      >
        {COLORS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
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
