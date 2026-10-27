"use client";

import Link from "next/link";
import { MessageSquare, ShieldAlert } from "lucide-react";
import { stopImpersonation } from "@/app/actions/admin";

export function ImpersonationBanner({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-warning/15 px-8 py-2 text-sm">
      <div className="flex items-center gap-2 text-warning">
        <ShieldAlert size={16} />
        <span>
          Modo soporte: estás viendo el workspace de <strong>{workspaceName}</strong> como
          administrador.
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* Con el modo soporte activo, la bandeja que se abre es la del espacio que se esta viendo. */}
        <Link
          href="/dashboard/inbox"
          className="flex items-center gap-1.5 rounded-md border border-warning/40 px-3 py-1 text-xs font-medium text-warning hover:bg-warning/10"
        >
          <MessageSquare size={13} />
          Ir al chat
        </Link>
        <form action={stopImpersonation}>
          <button
            type="submit"
            className="rounded-md border border-warning/40 px-3 py-1 text-xs font-medium text-warning hover:bg-warning/10"
          >
            Salir del modo soporte
          </button>
        </form>
      </div>
    </div>
  );
}
