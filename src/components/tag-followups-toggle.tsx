"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff } from "lucide-react";
import { toggleTagExcludesFollowups } from "@/app/actions/tags";

export function TagFollowupsToggle({
  tagId,
  excludesFollowups,
}: {
  tagId: string;
  excludesFollowups: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await toggleTagExcludesFollowups(tagId, !excludesFollowups);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={
        excludesFollowups
          ? "Los contactos con esta etiqueta están excluidos de todos los seguimientos — clic para quitar"
          : "Marcar: excluir de todos los seguimientos a los contactos con esta etiqueta"
      }
      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] disabled:opacity-50 ${
        excludesFollowups ? "bg-red-500/15 text-red-400" : "text-muted/60 hover:text-muted"
      }`}
    >
      <BellOff size={10} />
      {excludesFollowups && "Sin seguimientos"}
    </button>
  );
}
