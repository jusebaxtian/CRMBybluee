"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlanDescription } from "@/app/actions/plans";

export function PlanDescriptionEditor({
  planId,
  initialDescription,
}: {
  planId: string;
  initialDescription: string[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialDescription.join("\n"));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setMessage(null);
    const result = await updatePlanDescription(planId, value.split("\n"));
    setPending(false);
    if (result?.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Guardado.");
    router.refresh();
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
        Beneficios (uno por línea, se muestran al cliente)
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder={"Ej: Hasta 5.000 contactos\nSoporte prioritario\nAgente de IA incluido"}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar beneficios"}
        </button>
        {message && <p className="text-xs text-muted">{message}</p>}
      </div>
    </div>
  );
}
