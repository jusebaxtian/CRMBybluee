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
          ? "Los contactos con esta etiqueta quedan excluidos de TODAS las automatizaciones (palabra clave, etiqueta, botón y bienvenida), de la IA y de los seguimientos — clic para quitar"
          : "Marcar: excluir a los contactos con esta etiqueta de TODAS las automatizaciones (incluidas las de botón), de la IA y de los seguimientos. Úsala solo para contactos a los que ya no quieres escribirles (ej: ya compraron o no les interesa) — no para etiquetas de seguimiento como \"prospecto\" o \"en proceso\", o dejarían de recibir los flujos."
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
