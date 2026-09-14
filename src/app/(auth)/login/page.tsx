"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { login, type AuthFormState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Campo, CampoContrasena, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";
import { GoogleButton } from "@/components/auth/google-button";
import { useEntrarGuardando } from "@/components/auth/use-entrar-guardando";
import { RECUPERACION_POR_CORREO } from "@/lib/auth/telefono";

function LoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, undefined);
  const { alEnviar } = useEntrarGuardando(state);
  // /auth/callback vuelve aqui con ?error=... si Google no completo el ingreso.
  const errorGoogle = useSearchParams().get("error");

  return (
    <AuthShell
      titulo="Ingresa a tu cuenta"
      descripcion="Escribe tu correo y contraseña para entrar a tu CRM."
      pie={
        <>
          ¿No tienes una cuenta?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Regístrate
          </Link>
        </>
      }
    >
      <form action={action} onSubmit={alEnviar} noValidate className="flex flex-col gap-4">
        <Campo
          etiqueta="Correo electrónico"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="tu@empresa.com"
          defaultValue={state?.valores?.email ?? ""}
          error={state?.errores?.email}
          icono={<Mail size={16} />}
          disabled={pending}
        />
        <div>
          <CampoContrasena
            etiqueta="Contraseña"
            name="password"
            autoComplete="current-password"
            placeholder="Tu contraseña"
            error={state?.errores?.password}
            disabled={pending}
          />
          {RECUPERACION_POR_CORREO && (
            <div className="mt-2 text-right">
              <Link href="/recuperar" className="text-[13px] font-medium text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}
        </div>

        <ErrorFormulario>
          {state?.error ??
            (errorGoogle === "enlace"
              ? "Ese enlace venció o ya fue usado. Pide uno nuevo desde \"¿Olvidaste tu contraseña?\"."
              : errorGoogle
                ? "No se pudo entrar con Google. Intenta de nuevo o usa tu correo."
                : null)}
        </ErrorFormulario>

        <BotonEnviar cargando={pending} textoCargando="Entrando...">
          Iniciar sesión
        </BotonEnviar>
      </form>

      <GoogleButton posicion="abajo" />
    </AuthShell>
  );
}

// useSearchParams obliga a un limite de Suspense para que la pagina siga
// pudiendo prerenderizarse.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
