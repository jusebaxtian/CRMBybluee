"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Menu, X } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { OPCIONES_ADMIN } from "@/components/admin/menu-admin";

/**
 * Barra superior del panel admin en celular (en escritorio no se ve: ahi esta el
 * menu lateral). Muestra TODAS las opciones en un menu desplegable que se cierra
 * al elegir una.
 */
export function MenuMovilAdmin({ correo }: { correo: string }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-surface md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ByBluee" className="h-7 w-7 rounded-lg" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">ByBluee</p>
            <p className="text-[11px] text-muted">Panel admin</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground"
        >
          {abierto ? <X size={18} /> : <Menu size={18} />}
          Menú
        </button>
      </div>

      {abierto && (
        <nav className="max-h-[calc(100vh-57px)] overflow-y-auto border-t border-border px-3 pb-3 pt-2">
          {OPCIONES_ADMIN.map(({ href, etiqueta, Icono }) => {
            const activa = href === "/admin" ? ruta === "/admin" : ruta.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setAbierto(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${
                  activa ? "bg-surface-hover text-foreground" : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Icono size={18} />
                {etiqueta}
              </Link>
            );
          })}
          <Link href="/dashboard" onClick={() => setAbierto(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-primary hover:bg-surface-hover">
            <ArrowLeftRight size={18} />
            Volver a mi CRM
          </Link>
          <div className="mt-2 border-t border-border px-3 pt-3">
            <p className="mb-2 truncate text-xs text-muted">{correo}</p>
            <form action={logout}>
              <button
                type="submit"
                className="w-full rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </nav>
      )}
    </div>
  );
}
