"use client";

import { Suspense, useActionState, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { leerInvitacionRegistro } from "@/app/actions/pagos-chat";
import Link from "next/link";
import { Mail, User, Building2 } from "lucide-react";
import { signup, type AuthFormState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Campo, CampoContrasena, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";
import { CampoTelefono } from "@/components/auth/campo-telefono";
import { GoogleButton } from "@/components/auth/google-button";
import { useEntrarGuardando } from "@/components/auth/use-entrar-guardando";

type Invitacion = {
  phone: string | null;
  plan_name: string;
  amount_cents: number;
  currency: string;
  tipo: "pago" | "demo";
  dias_demo: number | null;
};

function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, undefined);
  const { alEnviar } = useEntrarGuardando(state);
  const v = state?.valores ?? {};
  const e = state?.errores ?? {};

  // Enlace de registro con pago (?i=token): soporte ya registro el pago
  // desde el chat; aqui se muestra y se precarga el WhatsApp.
  const token = useSearchParams().get("i") ?? "";
  const [invitacion, setInvitacion] = useState<Invitacion | null>(null);
  useEffect(() => {
    if (!token) return;
    let vivo = true;
    leerInvitacionRegistro(token).then((r) => {
      if (vivo) setInvitacion(r);
    });
    return () => {
      vivo = false;
    };
  }, [token]);
  const telefonoInv = invitacion?.phone ? parsePhoneNumberFromString(`+${invitacion.phone}`) : undefined;

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
        {token && <input type="hidden" name="invitacion" value={token} />}
        {invitacion && (
          <div className="rounded-[12px] border border-primary/30 bg-primary/10 px-3.5 py-3 text-[13px]">
            {invitacion.tipo === "demo" ? (
              <>
                <p className="font-semibold text-foreground">Cuenta demo por {invitacion.dias_demo ?? 2} días ✓</p>
                <p className="mt-0.5 text-muted">
                  Plan <strong className="text-foreground">{invitacion.plan_name}</strong>, sin pago. Crea tu cuenta y quedará
                  activa de inmediato.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">Tu pago ya está registrado ✓</p>
                <p className="mt-0.5 text-muted">
                  Plan <strong className="text-foreground">{invitacion.plan_name}</strong> ·{" "}
                  {new Intl.NumberFormat("es-CO", { style: "currency", currency: invitacion.currency || "COP", maximumFractionDigits: 0 }).format(
                    invitacion.amount_cents / 100
                  )}
                  . Crea tu cuenta y quedará activa de inmediato.
                </p>
              </>
            )}
          </div>
        )}
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
          key={telefonoInv ? "inv" : "libre"}
          error={e.phone}
          paisInicial={v.phoneCountry || telefonoInv?.country || undefined}
          numeroInicial={v.phone ?? telefonoInv?.nationalNumber ?? ""}
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

// useSearchParams obliga a un limite de Suspense para que la pagina siga
// pudiendo prerenderizarse.
export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
