"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, X } from "lucide-react";
import { idYoutube, miniaturaYoutube } from "@/lib/tutoriales/video";
import type { Tutorial } from "@/components/tutoriales/biblioteca-tutoriales";

const CLAVE = "bybluee:bienvenida-tutoriales";

/**
 * Ventana de bienvenida al primer ingreso (por navegador): invita a ver los
 * tutoriales. Se muestra una sola vez; despues queda el menu "Tutoriales".
 */
export function BienvenidaTutoriales({ destacados }: { destacados: Tutorial[] }) {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CLAVE)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMostrar(true);
      }
    } catch {}
  }, []);

  function cerrar() {
    setMostrar(false);
    try {
      localStorage.setItem(CLAVE, new Date().toISOString());
    } catch {}
  }

  if (!mostrar || destacados.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="relative flex w-full max-w-xl flex-col gap-4 rounded-t-2xl border border-border bg-surface p-6 pt-7 shadow-[0_30px_80px_rgba(0,0,0,0.7)] sm:rounded-2xl">
        <button type="button" onClick={cerrar} aria-label="Cerrar" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground">
          <X size={18} />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Primer ingreso</p>
        <h2 className="font-dash-display text-[22px] font-bold leading-tight tracking-[-.3px] text-foreground">¡Bienvenido a ByBluee! 👋</h2>
        <p className="text-sm leading-relaxed text-muted">
          Antes de empezar, mira estos videos cortos. En pocos minutos tendrás tu WhatsApp conectado y tu equipo respondiendo.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {destacados.slice(0, 3).map((t) => {
            const yt = idYoutube(t.url);
            return (
              <Link
                key={t.id}
                href={`/dashboard/tutoriales?ver=${t.id}`}
                onClick={cerrar}
                className="group overflow-hidden rounded-[10px] border border-border bg-background"
              >
                <div className="relative aspect-video bg-gradient-to-br from-[#16351f] to-[#0e1411]">
                  {yt && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={miniaturaYoutube(yt)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white transition-transform group-hover:scale-110">
                      <Play size={12} fill="currentColor" />
                    </span>
                  </span>
                </div>
                <div className="p-2 text-[12px] font-semibold leading-tight text-foreground">
                  {t.titulo}
                  {t.duracion && <div className="font-normal text-muted">{t.duracion}</div>}
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/tutoriales"
            onClick={cerrar}
            className="rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(27,168,74,0.35)] hover:bg-primary-hover"
          >
            Ver tutoriales
          </Link>
          <button type="button" onClick={cerrar} className="text-sm text-muted underline hover:text-foreground">
            Después, ir a mi bandeja
          </button>
          <span className="ml-auto text-[11px] text-muted">Siempre en el menú → Tutoriales</span>
        </div>
      </div>
    </div>
  );
}
