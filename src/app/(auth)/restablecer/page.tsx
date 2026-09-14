"use client";

import { useActionState } from "react";
import Link from "next/link";
import { restablecerContrasena, type AuthFormState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { CampoContrasena, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";

export default function RestablecerPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(restablecerContrasena, undefined);

  return (
    <AuthShell
      titulo="Crea una contraseña nueva"
      descripcion="Elige una contraseña que no uses en otro sitio. Mínimo 8 caracteres."
      pie={
        state?.error ? (
          <Link href="/recuperar" className="font-semibold text-primary hover:underline">
            Pedir un enlace nuevo
          </Link>
        ) : undefined
      }
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        <CampoContrasena
          etiqueta="Nueva contraseña"
          name="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          error={state?.errores?.password}
          disabled={pending}
        />
        <CampoContrasena
          etiqueta="Confirmar contraseña"
          name="passwordConfirm"
          autoComplete="new-password"
          placeholder="Repite la contraseña"
          error={state?.errores?.passwordConfirm}
          disabled={pending}
        />
        <ErrorFormulario>{state?.error}</ErrorFormulario>
        <BotonEnviar cargando={pending} textoCargando="Guardando...">
          Guardar contraseña
        </BotonEnviar>
      </form>
    </AuthShell>
  );
}
