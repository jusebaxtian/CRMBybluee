"use client";

import { Trash2 } from "lucide-react";
import { deleteTag } from "@/app/actions/tags";

export function DeleteTagButton({ tagId }: { tagId: string }) {
  return (
    <button
      type="button"
      onClick={() => deleteTag(tagId)}
      className="text-muted hover:text-red-400"
      title="Eliminar etiqueta"
    >
      <Trash2 size={14} />
    </button>
  );
}
