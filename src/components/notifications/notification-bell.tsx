"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  cta_label?: string | null;
  cta_url?: string | null;
};

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Marcadas en esta sesion: desaparecen de la lista al instante, sin
  // esperar a que el servidor vuelva a renderizar la pagina.
  const [leidasAhora, setLeidasAhora] = useState<string[]>([]);
  const [verLeidas, setVerLeidas] = useState(false);

  const estaLeida = (n: Notification) => n.read || leidasAhora.includes(n.id);
  const noLeidas = notifications.filter((n) => !estaLeida(n));
  const leidas = notifications.filter((n) => estaLeida(n));
  const visibles = verLeidas ? notifications : noLeidas;

  function marcarLeida(id: string) {
    setLeidasAhora((prev) => (prev.includes(id) ? prev : [...prev, id]));
    void markNotificationRead(id).then(() => router.refresh());
  }

  function marcarTodas() {
    const ids = noLeidas.map((n) => n.id);
    if (ids.length === 0) return;
    setLeidasAhora((prev) => [...new Set([...prev, ...ids])]);
    void markAllNotificationsRead(ids).then(() => router.refresh());
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={noLeidas.length > 0 ? `${noLeidas.length} notificaciones sin leer` : "Notificaciones"}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground"
      >
        <Bell size={16} />
        {noLeidas.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
            {noLeidas.length > 9 ? "9+" : noLeidas.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <p className="text-sm font-medium text-foreground">Notificaciones</p>
            {noLeidas.length > 0 && (
              <button
                type="button"
                onClick={marcarTodas}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
              >
                <CheckCheck size={12} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visibles.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted">
                {leidas.length > 0 ? "Estás al día ✓" : "Sin notificaciones."}
              </p>
            )}
            {visibles.map((n) => {
              const leida = estaLeida(n);
              return (
                <div
                  key={n.id}
                  onClick={() => !leida && marcarLeida(n.id)}
                  className={`group relative border-b border-border px-4 py-3 last:border-b-0 ${
                    leida ? "opacity-60" : "cursor-pointer hover:bg-surface-hover"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!leida && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{n.title}</p>
                    {!leida && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          marcarLeida(n.id);
                        }}
                        title="Marcar como leída"
                        aria-label="Marcar como leída"
                        className="shrink-0 rounded-md p-1 text-muted hover:bg-surface-hover hover:text-primary"
                      >
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted">{new Date(n.created_at).toLocaleString("es-CO")}</p>
                  {n.cta_label && n.cta_url && (
                    <a
                      href={n.cta_url}
                      // Enlaces internos (ej. "Ir a su chat") abren en la misma pestaña.
                      {...(n.cta_url.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!leida) marcarLeida(n.id);
                        if (n.cta_url?.startsWith("/")) setOpen(false);
                      }}
                      className="mt-2 inline-block rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-hover"
                    >
                      {n.cta_label}
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {leidas.length > 0 && (
            <button
              type="button"
              onClick={() => setVerLeidas((v) => !v)}
              className="w-full border-t border-border px-4 py-2 text-center text-[11px] text-muted hover:text-foreground"
            >
              {verLeidas ? "Ocultar leídas" : `Ver leídas (${leidas.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
