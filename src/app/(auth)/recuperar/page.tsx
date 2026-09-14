"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, MailCheck } from "lucide-react";
import { solicitarRecuperacion, type AuthFormState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Campo, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";

function RecuperarForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(solicitarRecuperacion, undefined);
  const enlaceVencido = useSearchParams().get("error") === "enlace";

  return (
    <AuthShell
      titulo="Recupera tu contraseña"
      descripcion="Escribe el correo de tu cuenta y te enviamos un enlace para crear una contraseña nueva."
      pie={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {state?.ok ? (
        <div className="rounded-[12px] border border-primary/30 bg-primary/10 p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
            <MailCheck size={18} className="text-success" />
            Revisa tu correo
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{state.ok}</p>
        </div>
      ) : (
        <form action={action} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Correo electrónico"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@empresa.com"
            defaultValue={state?.valores?.email ?? ""}
            error={state?.errores?.email}
            icono={<Mail size={16} />}
            disabled={pending}
          />
          <ErrorFormulario>
            {state?.error ?? (enlaceVencido ? "Ese enlace venció o ya fue usado. Pide uno nuevo." : null)}
          </ErrorFormulario>
          <BotonEnviar cargando={pending} textoCargando="Enviando...">
            Enviar enlace
          </BotonEnviar>
        </form>
      )}
    </AuthShell>
  );
}

export default function RecuperarPage() {
  return (
    <Suspense>
      <RecuperarForm />
    </Suspense>
  );
}
