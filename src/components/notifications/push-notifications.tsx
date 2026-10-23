"use client";

import { useEffect, useState } from "react";
import { Bell, Download, Share, X } from "lucide-react";
import { tocaMostrarAviso } from "@/lib/push/estado";
import { useNotificaciones } from "@/components/notifications/usar-notificaciones";

const CLAVE_CERRADO = "crm-aviso-notificaciones-cerrado-el";

function leerCerrado(): number | null {
  try {
    const v = localStorage.getItem(CLAVE_CERRADO);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/**
 * Aviso de abajo para quien aun no tiene las notificaciones: si lo cierra, vuelve
 * a salir a los pocos dias (antes, en iPhone, no volvia a salir nunca). Ademas
 * pone el numero de chats sin leer en el icono de la app, como una app de mensajes.
 */
export function PushNotifications({ sinLeer = 0 }: { sinLeer?: number }) {
  const { estado, puedeInstalar, trabajando, activar, instalar } = useNotificaciones();
  const [descartado, setDescartado] = useState(false);
  const [ahora] = useState(() => Date.now());
  // Mientras el estado es "cargando" no se pinta nada, asi que leer localStorage aqui no rompe la hidratacion.
  const visible =
    !descartado && (estado === "por-activar" || estado === "ios-instalar") && tocaMostrarAviso(leerCerrado(), ahora);

  // Numero de chats sin leer en el icono de la app instalada (donde el sistema lo permite).
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    (sinLeer > 0 ? nav.setAppBadge(sinLeer) : nav.clearAppBadge()).catch(() => {});
  }, [sinLeer]);

  function cerrar() {
    try {
      localStorage.setItem(CLAVE_CERRADO, String(Date.now()));
    } catch {
      // Sin almacenamiento: se cierra solo por esta visita.
    }
    setDescartado(true);
  }

  if (!visible) return null;

  const ios = estado === "ios-instalar";

  return (
    <div className="fixed inset-x-0 bottom-14 z-50 border-t border-border bg-surface p-3 shadow-lg lg:bottom-0">
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bell size={16} />
        </div>
        <div className="min-w-0 flex-1">
          {ios ? (
            <p className="text-xs text-foreground">
              Para recibir los mensajes en tu iPhone, aunque esté bloqueado, instala ByBluee: toca{" "}
              <Share size={13} className="inline -translate-y-0.5" /> (Compartir) y luego{" "}
              <strong>&quot;Añadir a pantalla de inicio&quot;</strong>. Ábrela desde ese ícono, no desde Safari.
            </p>
          ) : (
            <>
              <p className="text-xs text-foreground">
                <strong>Activa las notificaciones</strong> para saber al instante quién te escribe, aunque la app esté cerrada o el celular bloqueado.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await activar();
                    if (ok) setDescartado(true);
                  }}
                  disabled={trabajando}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {trabajando ? "Activando…" : "Activar"}
                </button>
                {puedeInstalar && (
                  <button
                    type="button"
                    onClick={() => void instalar()}
                    className="flex items-center gap-1 rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    <Download size={12} /> Instalar app
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <button type="button" onClick={cerrar} className="shrink-0 text-muted hover:text-foreground" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
