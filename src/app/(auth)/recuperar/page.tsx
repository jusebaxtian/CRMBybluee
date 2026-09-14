"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, KeyRound } from "lucide-react";
import { solicitarCodigoRecuperacion, restablecerConCodigo, type AuthFormState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Campo, CampoContrasena, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

/**
 * Recuperar contraseña por WhatsApp, en dos pasos sobre la misma pantalla:
 * 1) correo -> llega un codigo al WhatsApp del espacio;
 * 2) codigo + contraseña nueva -> entra directo.
 */
export default function RecuperarPage() {
  const [paso1, accionPaso1, enviando1] = useActionState<AuthFormState, FormData>(solicitarCodigoRecuperacion, undefined);
  const [paso2, accionPaso2, enviando2] = useActionState<AuthFormState, FormData>(restablecerConCodigo, undefined);

  const enPaso2 = paso1?.valores?.paso === "codigo";
  const email = paso2?.valores?.email ?? paso1?.valores?.email ?? "";

  return (
    <AuthShell
      titulo="Recupera tu contraseña"
      descripcion={
        enPaso2
          ? "Escribe el código que te llegó por WhatsApp y elige tu contraseña nueva."
          : "Escribe el correo de tu cuenta y te enviamos un código por WhatsApp al número con el que te registraste."
      }
      pie={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {enPaso2 ? (
        <form action={accionPaso2} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="email" value={email} />

          <div className="flex items-start gap-3 rounded-[12px] border border-primary/30 bg-primary/10 p-3.5">
            <WhatsAppIcon size={20} className="mt-0.5 shrink-0 text-success" />
            <p className="text-[13px] leading-relaxed text-foreground">{paso1?.ok}</p>
          </div>

          <Campo
            etiqueta="Código de 6 dígitos"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            autoFocus
            error={paso2?.errores?.codigo}
            icono={<KeyRound size={16} />}
            className="tracking-[0.3em]"
            disabled={enviando2}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoContrasena
              etiqueta="Nueva contraseña"
              name="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              error={paso2?.errores?.password}
              disabled={enviando2}
            />
            <CampoContrasena
              etiqueta="Confirmar contraseña"
              name="passwordConfirm"
              autoComplete="new-password"
              placeholder="Repite la contraseña"
              error={paso2?.errores?.passwordConfirm}
              disabled={enviando2}
            />
          </div>

          <ErrorFormulario>{paso2?.error}</ErrorFormulario>

          <BotonEnviar cargando={enviando2} textoCargando="Guardando...">
            Cambiar contraseña y entrar
          </BotonEnviar>

          <p className="text-center text-[12.5px] text-muted">
            ¿No te llegó?{" "}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-semibold text-primary hover:underline"
            >
              Pedir otro código
            </button>
          </p>
        </form>
      ) : (
        <form action={accionPaso1} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Correo electrónico"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@empresa.com"
            defaultValue={email}
            error={paso1?.errores?.email}
            icono={<Mail size={16} />}
            disabled={enviando1}
          />
          <ErrorFormulario>{paso1?.error}</ErrorFormulario>
          <BotonEnviar cargando={enviando1} textoCargando="Enviando por WhatsApp...">
            Enviar código por WhatsApp
          </BotonEnviar>
        </form>
      )}
    </AuthShell>
  );
}
