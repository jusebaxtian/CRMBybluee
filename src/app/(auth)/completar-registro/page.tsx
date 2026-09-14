"use client";

import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { completarRegistro, type AuthFormState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Campo, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";
import { CampoTelefono } from "@/components/auth/campo-telefono";

export default function CompletarRegistroPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(completarRegistro, undefined);
  const v = state?.valores ?? {};
  const e = state?.errores ?? {};

  return (
    <AuthShell
      titulo="Un último paso"
      descripcion="Tu cuenta de Google ya quedó lista. Cuéntanos de tu negocio para crear tu espacio."
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre de la empresa"
          name="companyName"
          autoComplete="organization"
          placeholder="Nombre de la empresa"
          defaultValue={v.companyName ?? ""}
          error={e.companyName}
          icono={<Building2 size={16} />}
          autoFocus
          disabled={pending}
        />
        <CampoTelefono
          error={e.phone}
          paisInicial={v.phoneCountry || undefined}
          numeroInicial={v.phone ?? ""}
          disabled={pending}
        />
        <ErrorFormulario>{state?.error}</ErrorFormulario>
        <BotonEnviar cargando={pending} textoCargando="Creando tu espacio...">
          Entrar al CRM
        </BotonEnviar>
      </form>
    </AuthShell>
  );
}
