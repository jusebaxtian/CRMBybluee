"use client";

import { ShieldAlert } from "lucide-react";
import { stopImpersonation } from "@/app/actions/admin";

export function ImpersonationBanner({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex items-center justify-between bg-warning/15 px-8 py-2 text-sm">
      <div className="flex items-center gap-2 text-warning">
        <ShieldAlert size={16} />
        <span>
          Modo soporte: estás viendo el workspace de <strong>{workspaceName}</strong> como
          administrador.
        </span>
      </div>
      <form action={stopImpersonation}>
        <button
          type="submit"
          className="rounded-md border border-warning/40 px-3 py-1 text-xs font-medium text-warning hover:bg-warning/10"
        >
          Salir del modo soporte
        </button>
      </form>
    </div>
  );
}
