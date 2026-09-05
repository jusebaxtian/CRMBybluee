"use client";

import { useOptimistic, useTransition } from "react";
import { BellOff } from "lucide-react";
import { toggleTagExcludesFollowups } from "@/app/actions/tags";

export function TagFollowupsToggle({
  tagId,
  excludesFollowups,
}: {
  tagId: string;
  excludesFollowups: boolean;
}) {
  // La etiqueta cambia de estado al instante; la accion revalida y trae el
  // valor real. Sin router.refresh(): era una segunda vuelta al servidor.
  const [optimisticExcludes, setOptimisticExcludes] = useOptimistic(excludesFollowups);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !optimisticExcludes;
    startTransition(async () => {
      setOptimisticExcludes(next);
      await toggleTagExcludesFollowups(tagId, next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        optimisticExcludes
          ? "Los contactos con esta etiqueta están excluidos de automatizaciones (por palabra clave o etiqueta), de la IA y de seguimientos — clic para quitar"
          : "Marcar: excluir a los contactos con esta etiqueta de automatizaciones, IA y seguimientos (ej: clientes que ya compraron)"
      }
      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] ${
        optimisticExcludes ? "bg-red-500/15 text-red-400" : "text-muted/60 hover:text-muted"
      }`}
    >
      <BellOff size={10} />
      {optimisticExcludes && "Sin automatizaciones"}
    </button>
  );
}
