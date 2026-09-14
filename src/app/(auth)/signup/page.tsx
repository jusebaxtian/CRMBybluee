"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, User, Building2 } from "lucide-react";
import { signup, type AuthFormState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Campo, CampoContrasena, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";
import { CampoTelefono } from "@/components/auth/campo-telefono";
import { GoogleButton } from "@/components/auth/google-button";
import { useEntrarGuardando } from "@/components/auth/use-entrar-guardando";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, undefined);
  const { alEnviar } = useEntrarGuardando(state);
  const v = state?.valores ?? {};
  const e = state?.errores ?? {};

  return (
    <AuthShell
      titulo="Crea tu cuenta"
      descripcion="Empieza a vender por WhatsApp con la API oficial. Sin tarjeta, en menos de un minuto."
      ancho="max-w-[440px]"
      pie={
        <>
          ¿Ya tienes una cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form action={action} onSubmit={alEnviar} noValidate className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre del cliente"
          name="fullName"
          autoComplete="name"
          placeholder="Nombre completo"
          defaultValue={v.fullName ?? ""}
          error={e.fullName}
          icono={<User size={16} />}
          disabled={pending}
        />
        <Campo
          etiqueta="Nombre de la empresa"
          name="companyName"
          autoComplete="organization"
          placeholder="Nombre de la empresa"
          defaultValue={v.companyName ?? ""}
          error={e.companyName}
          icono={<Building2 size={16} />}
          disabled={pending}
        />
        <CampoTelefono
          error={e.phone}
          paisInicial={v.phoneCountry || undefined}
          numeroInicial={v.phone ?? ""}
          disabled={pending}
        />
        <Campo
          etiqueta="Correo electrónico"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="tu@empresa.com"
          defaultValue={v.email ?? ""}
          error={e.email}
          icono={<Mail size={16} />}
          disabled={pending}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoContrasena
            etiqueta="Contraseña"
            name="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            error={e.password}
            disabled={pending}
          />
          <CampoContrasena
            etiqueta="Confirmar contraseña"
            name="passwordConfirm"
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            error={e.passwordConfirm}
            disabled={pending}
          />
        </div>

        <ErrorFormulario>{state?.error}</ErrorFormulario>

        <BotonEnviar cargando={pending} textoCargando="Creando tu cuenta...">
          Crear cuenta
        </BotonEnviar>
      </form>

      <GoogleButton texto="Registrarme con Google" posicion="abajo" />
    </AuthShell>
  );
}
