"use client";

import { ChevronDown, Menu } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { NotificationBell } from "@/components/notification-bell";
import { ChangePasswordButton } from "@/components/change-password-button";

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  cta_label?: string | null;
  cta_url?: string | null;
};

export function Topbar({
  workspaceName,
  userEmail,
  notifications,
  onMenuClick,
}: {
  workspaceName: string;
  userEmail: string;
  notifications: Notification[];
  onMenuClick?: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-2.5 sm:px-8 sm:py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-foreground sm:text-lg">Dashboard</h1>
          <p className="hidden text-xs text-muted sm:block">Resumen general de tu cuenta</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell notifications={notifications} />

        <div className="group relative">
          <div className="flex cursor-default items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white">
              {workspaceName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm text-foreground sm:inline">{workspaceName}</span>
            <ChevronDown size={14} className="text-muted" />
          </div>
          <div className="invisible absolute right-0 z-10 mt-2 w-56 rounded-lg border border-border bg-surface p-2 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
            <p className="truncate px-2 py-1 text-xs text-muted">{userEmail}</p>
            <ChangePasswordButton />
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
