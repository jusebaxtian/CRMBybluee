"use client";

import { useState } from "react";
import { Megaphone, X } from "lucide-react";
import { markNotificationRead } from "@/app/actions/notifications";

export type AvisoPantallaData = {
  id: string;
  title: string;
  body: string;
  cta_label?: string | null;
  cta_url?: string | null;
};

/**
 * Aviso emergente a pantalla completa (notificaciones con modo 'pantalla').
 * Se muestra la primera no leida al abrir el panel; cerrarla o pulsar el
 * boton la marca como leida para el espacio y ya no vuelve a salir. Si hay
 * varias pendientes, salen una tras otra.
 */
export function AvisoPantalla({ avisos }: { avisos: AvisoPantallaData[] }) {
  const [cerrados, setCerrados] = useState<string[]>([]);
  const actual = avisos.find((a) => !cerrados.includes(a.id));
  if (!actual) return null;

  function cerrar() {
    if (!actual) return;
    setCerrados((c) => [...c, actual.id]);
    void markNotificationRead(actual.id);
  }

  const externo = !!actual.cta_url && /^https?:\/\//.test(actual.cta_url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-titulo"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-t-2xl border border-border bg-surface p-6 pt-7 shadow-[0_30px_80px_rgba(0,0,0,0.7)] sm:rounded-2xl">
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Megaphone size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Aviso de ByBluee</p>
            <h2 id="aviso-titulo" className="font-dash-display text-[20px] font-bold leading-tight tracking-[-.3px] text-foreground">
              {actual.title}
            </h2>
          </div>
        </div>

        <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-foreground/85">{actual.body}</p>

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-[10px] border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground"
          >
            Cerrar
          </button>
          {actual.cta_url && actual.cta_label && (
            <a
              href={actual.cta_url}
              target={externo ? "_blank" : undefined}
              rel={externo ? "noopener noreferrer" : undefined}
              onClick={cerrar}
              className="rounded-[10px] bg-primary px-5 py-2.5 text-center text-sm font-bold text-white shadow-[0_8px_24px_rgba(27,168,74,0.35)] hover:bg-primary-hover"
            >
              {actual.cta_label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
