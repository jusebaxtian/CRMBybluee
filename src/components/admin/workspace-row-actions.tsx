"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Power, Trash2 } from "lucide-react";
import { toggleWorkspaceAccess, deleteWorkspace } from "@/app/actions/admin";

export function WorkspaceRowActions({
  workspaceId,
  workspaceName,
  accessDisabled,
}: {
  workspaceId: string;
  workspaceName: string;
  accessDisabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleToggleAccess() {
    setPending(true);
    await toggleWorkspaceAccess(workspaceId, !accessDisabled);
    setPending(false);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `¿Eliminar permanentemente "${workspaceName}"? Esto borra todos sus datos (contactos, conversaciones, campañas, pagos) y no se puede deshacer.`
    );
    if (!confirmed) return;

    setPending(true);
    await deleteWorkspace(workspaceId);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/workspaces/${workspaceId}`}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted hover:text-foreground"
        title="Editar"
      >
        <Pencil size={13} />
      </Link>
      <button
        type="button"
        onClick={handleToggleAccess}
        disabled={pending}
        className={`flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-50 ${
          accessDisabled
            ? "border-success text-success hover:bg-success/10"
            : "border-warning text-warning hover:bg-warning/10"
        }`}
        title={accessDisabled ? "Activar acceso" : "Desactivar acceso"}
      >
        <Power size={13} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-red-400 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        title="Eliminar cuenta"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
