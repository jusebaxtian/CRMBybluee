"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { markNotificationRead } from "@/app/actions/notifications";

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
};

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleOpen() {
    setOpen((o) => !o);
  }

  async function handleRead(id: string) {
    await markNotificationRead(id);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-2">
            <p className="text-sm font-medium text-foreground">Notificaciones</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted">Sin notificaciones.</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && handleRead(n.id)}
                className={`cursor-pointer border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-hover ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                <p className="mt-1 text-[10px] text-muted">
                  {new Date(n.created_at).toLocaleString("es-CO")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
