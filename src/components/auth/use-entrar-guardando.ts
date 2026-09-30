"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { guardarCredencial } from "@/lib/auth/guardar-credencial";
import type { AuthFormState } from "@/app/actions/auth";

/**
 * Login y registro: captura correo y contraseña al enviar el formulario y,
 * cuando la accion responde, guarda la credencial y navega.
 *
 * Dos destinos: "entrar" va al panel, y "completar" a terminar el registro
 * --el caso en que la cuenta se creo pero su espacio no--. En los dos la
 * sesion ya esta activa, por eso se guarda igual la contraseña: la persona
 * va a necesitarla la proxima vez, falle lo que falle despues.
 */
export function useEntrarGuardando(state: AuthFormState) {
  const router = useRouter();
  const credencial = useRef<{ id: string; password: string } | null>(null);

  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    const f = new FormData(e.currentTarget);
    credencial.current = { id: String(f.get("email") ?? ""), password: String(f.get("password") ?? "") };
  }

  useEffect(() => {
    if (state?.ok !== "entrar" && state?.ok !== "completar") return;
    const destino = state.ok === "completar" ? "/completar-registro" : "/dashboard";
    const c = credencial.current;
    (async () => {
      if (c?.id && c.password) await guardarCredencial(c.id, c.password);
      router.push(destino);
      router.refresh();
    })();
  }, [state, router]);

  return { alEnviar };
}
