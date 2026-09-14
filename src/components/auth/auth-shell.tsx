import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPanel } from "@/components/auth/product-panel";

/**
 * Marco comun de las pantallas de autenticacion (login, registro,
 * recuperar y restablecer contraseña, completar registro).
 *
 * Escritorio: dos columnas al 50 % — formulario a la izquierda, panel del
 * producto a la derecha. En tablet y movil el formulario ocupa todo el ancho
 * y el panel se oculta: lo que importa ahi es entrar rapido.
 */
export function AuthShell({
  titulo,
  descripcion,
  children,
  pie,
  ancho = "max-w-[400px]",
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  /** Enlace inferior ("¿No tienes cuenta? Regístrate"). */
  pie?: ReactNode;
  ancho?: string;
}) {
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <main className="flex flex-col px-6 py-8 sm:px-10 lg:px-16 xl:px-24">
        <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="ByBluee">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-[10px]" />
          <span className="font-dash-display text-[17px] font-bold tracking-[-.3px]">ByBluee</span>
        </Link>

        <div className={`my-auto w-full ${ancho} py-10`}>
          <h1 className="font-dash-display text-[28px] font-bold leading-tight tracking-[-.5px] sm:text-[32px]">
            {titulo}
          </h1>
          {descripcion && <p className="mt-2 text-[14px] leading-relaxed text-muted">{descripcion}</p>}

          <div className="mt-8">{children}</div>

          {pie && <p className="mt-8 text-center text-[13.5px] text-muted">{pie}</p>}
        </div>
      </main>

      <aside className="hidden p-4 lg:block">
        <ProductPanel />
      </aside>
    </div>
  );
}
