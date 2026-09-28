"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import {
  cambiarContrasena,
  solicitarCodigo,
  verificarCodigo,
  type RecuperacionState,
} from "@/app/actions/recuperacion";
import { AuthShell } from "@/components/auth/auth-shell";
import { Campo, CampoContrasena, BotonEnviar, ErrorFormulario } from "@/components/auth/campos";

/**
 * Recuperacion por WhatsApp, en tres pasos y en una sola pantalla.
 *
 * El codigo llega por WhatsApp al numero del espacio; la contraseña nueva se
 * escribe aqui, nunca en el chat. Los pasos viven en esta pagina y no en tres
 * rutas para no tener que pasar el correo por la URL.
 */
export default function RecuperarPage() {
  const [paso, setPaso] = useState<"correo" | "codigo" | "clave" | "listo">("correo");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");

  if (paso === "correo") {
    return (
      <PasoCorreo
        onEnviado={(tel, email) => {
          setTelefono(tel);
          setCorreo(email);
          setPaso("codigo");
        }}
      />
    );
  }

  if (paso === "codigo") {
    return (
      <PasoCodigo
        correo={correo}
        telefono={telefono}
        onVerificado={() => setPaso("clave")}
        onVolver={() => setPaso("correo")}
      />
    );
  }

  if (paso === "clave") return <PasoClave onListo={() => setPaso("listo")} />;

  return (
    <AuthShell titulo="Contraseña cambiada" descripcion="Ya puedes entrar con tu contraseña nueva.">
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 rounded-[12px] border border-success/30 bg-success/10 p-4 text-[14px] font-semibold text-foreground">
          <CheckCircle2 size={18} className="shrink-0 text-success" />
          Listo, tu contraseña quedó actualizada.
        </p>
        <Link
          href="/login"
          className="rounded-[10px] bg-primary px-4 py-2.5 text-center text-[14px] font-semibold text-white hover:bg-primary-hover"
        >
          Iniciar sesión
        </Link>
      </div>
    </AuthShell>
  );
}

function PasoCorreo({ onEnviado }: { onEnviado: (telefono: string, correo: string) => void }) {
  const [state, action, pending] = useActionState<RecuperacionState, FormData>(
    async (prev, formData) => {
      const resultado = await solicitarCodigo(prev, formData);
      if (resultado?.paso === "codigo") {
        onEnviado(resultado.telefono ?? "", String(formData.get("email") ?? ""));
      }
      return resultado;
    },
    undefined
  );

  return (
    <AuthShell
      titulo="Recupera tu contraseña"
      descripcion="Escribe el correo de tu cuenta y te enviamos un código por WhatsApp al número registrado."
      pie={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        <Campo
          etiqueta="Correo electrónico"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@empresa.com"
          defaultValue={state?.valores?.email}
          error={state?.errores?.email}
          disabled={pending}
        />
        <p className="flex items-start gap-2 rounded-[10px] border border-border bg-surface px-3 py-2 text-[12.5px] leading-relaxed text-muted">
          <MessageCircle size={14} className="mt-0.5 shrink-0 text-primary" />
          El código llega por WhatsApp al número con el que registraste tu cuenta. Si ya no tienes acceso a ese
          número, escríbenos a soporte.
        </p>
        <ErrorFormulario>{state?.error}</ErrorFormulario>
        <BotonEnviar cargando={pending} textoCargando="Enviando código...">
          Enviarme el código
        </BotonEnviar>
      </form>
    </AuthShell>
  );
}

function PasoCodigo({
  correo,
  telefono,
  onVerificado,
  onVolver,
}: {
  correo: string;
  telefono: string;
  onVerificado: () => void;
  onVolver: () => void;
}) {
  const [state, action, pending] = useActionState<RecuperacionState, FormData>(
    async (prev, formData) => {
      const resultado = await verificarCodigo(prev, formData);
      if (resultado?.paso === "listo") onVerificado();
      return resultado;
    },
    undefined
  );

  return (
    <AuthShell
      titulo="Escribe el código"
      descripcion={`Te enviamos un código de 6 dígitos por WhatsApp al ${telefono || "número registrado"}. Vence en 10 minutos.`}
      pie={
        <button type="button" onClick={onVolver} className="font-semibold text-primary hover:underline">
          Usar otro correo
        </button>
      }
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="email" value={correo} />
        <Campo
          etiqueta="Código"
          name="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          error={state?.errores?.codigo}
          disabled={pending}
        />
        <ErrorFormulario>{state?.error}</ErrorFormulario>
        <BotonEnviar cargando={pending} textoCargando="Verificando...">
          Verificar código
        </BotonEnviar>
      </form>
    </AuthShell>
  );
}

function PasoClave({ onListo }: { onListo: () => void }) {
  const [state, action, pending] = useActionState<RecuperacionState, FormData>(
    async (prev, formData) => {
      const resultado = await cambiarContrasena(prev, formData);
      if (resultado?.paso === "listo") onListo();
      return resultado;
    },
    undefined
  );

  return (
    <AuthShell
      titulo="Crea una contraseña nueva"
      descripcion="Elige una contraseña que no uses en otro sitio. Mínimo 8 caracteres."
      pie={
        state?.error ? (
          <Link href="/recuperar" className="font-semibold text-primary hover:underline">
            Pedir un código nuevo
          </Link>
        ) : undefined
      }
    >
      <form action={action} noValidate className="flex flex-col gap-4">
        <p className="flex items-center gap-2 rounded-[10px] border border-success/30 bg-success/10 px-3 py-2 text-[12.5px] text-foreground">
          <ShieldCheck size={14} className="shrink-0 text-success" />
          Código verificado. Tienes 15 minutos para escribir la contraseña nueva.
        </p>
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
          name="confirmacion"
          autoComplete="new-password"
          placeholder="Repite la contraseña"
          error={state?.errores?.confirmacion}
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
