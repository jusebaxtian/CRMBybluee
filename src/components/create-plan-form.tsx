"use client";

import { useActionState } from "react";
import { createPlan } from "@/app/actions/plans";

export function CreatePlanForm() {
  const [state, action, pending] = useActionState(createPlan, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="name" className="mb-1 block text-xs font-medium text-muted">
          Nombre del plan
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Pro"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="price" className="mb-1 block text-xs font-medium text-muted">
          Precio (COP/mes)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          required
          placeholder="250000"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      <input type="hidden" name="billingCycle" value="monthly" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Creando..." : "Crear plan"}
      </button>
      {state && "error" in state && <p className="w-full text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
