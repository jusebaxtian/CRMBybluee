"use client";

import { ChevronDown, Bell } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function Topbar({
  workspaceName,
  userEmail,
}: {
  workspaceName: string;
  userEmail: string;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">Resumen general de tu cuenta</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
          title="Notificaciones (próximamente)"
          disabled
        >
          <Bell size={16} />
        </button>

        <div className="group relative">
          <div className="flex cursor-default items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white">
              {workspaceName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-foreground">{workspaceName}</span>
            <ChevronDown size={14} className="text-muted" />
          </div>
          <div className="invisible absolute right-0 z-10 mt-2 w-56 rounded-lg border border-border bg-surface p-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
            <p className="truncate px-2 py-1 text-xs text-muted">{userEmail}</p>
            <form action={logout}>
              <button
                type="submit"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-surface-hover"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
