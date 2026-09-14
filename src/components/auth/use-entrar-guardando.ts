"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { guardarCredencial } from "@/lib/auth/guardar-credencial";
import type { AuthFormState } from "@/app/actions/auth";

/**
 * Login y registro: captura correo y contraseña al enviar el formulario y,
 * cuando la accion responde ok = "entrar", pide al navegador guardarlos y
 * navega al panel.
 */
export function useEntrarGuardando(state: AuthFormState) {
  const router = useRouter();
  const credencial = useRef<{ id: string; password: string } | null>(null);

  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    const f = new FormData(e.currentTarget);
    credencial.current = { id: String(f.get("email") ?? ""), password: String(f.get("password") ?? "") };
  }

  useEffect(() => {
    if (state?.ok !== "entrar") return;
    const c = credencial.current;
    (async () => {
      if (c?.id && c.password) await guardarCredencial(c.id, c.password);
      router.push("/dashboard");
      router.refresh();
    })();
  }, [state, router]);

  return { alEnviar };
}
