"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * "Continuar con Google" (login y registro).
 *
 * Solo se muestra cuando NEXT_PUBLIC_LOGIN_GOOGLE=1: asi el boton no aparece
 * en un entorno donde el proveedor todavia no esta configurado en Supabase.
 * El resto del flujo vive en /auth/callback y /completar-registro.
 */
export function GoogleButton({
  texto = "Continuar con Google",
  posicion = "arriba",
}: {
  texto?: string;
  /** "abajo": separador "o" encima y boton debajo del formulario (pantallas de auth rediseñadas). */
  posicion?: "arriba" | "abajo";
}) {
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (process.env.NEXT_PUBLIC_LOGIN_GOOGLE !== "1") return null;

  async function entrar() {
    setPendiente(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Siempre deja elegir la cuenta: quien tiene varias no queda pegado a la primera.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError("No se pudo iniciar con Google. Intenta de nuevo.");
      setPendiente(false);
    }
  }

  const separador = (
    <div className="flex items-center gap-3 text-[12px] text-muted">
      <span className="h-px flex-1 bg-border" />
      {posicion === "abajo" ? "o" : "o con tu correo"}
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  const boton = (
    <>
      <button
        type="button"
        onClick={() => void entrar()}
        disabled={pendiente}
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[10px] border border-border bg-surface px-4 text-[14px] font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
          <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        {pendiente ? "Abriendo Google..." : texto}
      </button>
      {error && <p className="mt-2 text-[12.5px] text-error">{error}</p>}
    </>
  );

  return posicion === "abajo" ? (
    <div className="mt-6 flex flex-col gap-5">
      {separador}
      {boton}
    </div>
  ) : (
    <div className="mb-5 flex flex-col gap-5">
      {boton}
      {separador}
    </div>
  );
}
