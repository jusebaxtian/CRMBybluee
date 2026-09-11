"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { connectWhatsApp } from "@/app/actions/whatsapp";
import {
  interpretarMensajeDeAlta,
  esOrigenDeMeta,
  mensajeDeAlta,
  type ResultadoAlta,
} from "@/lib/whatsapp/embedded-signup";

declare global {
  interface Window {
    FB: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

type SignupData = { waba_id: string; phone_number_id: string };
type Status = "idle" | "connecting" | "error" | "success";

export function ConnectWhatsAppButton({
  label = "Conectar WhatsApp",
  askLabel = false,
  disabled = false,
}: {
  label?: string;
  /** Show a "nombre de este canal" field (Ventas, Soporte…) before connecting — used once a workspace already has one number and is adding another. */
  askLabel?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [channelLabel, setChannelLabel] = useState("");
  const signupDataRef = useRef<SignupData | null>(null);
  const ultimoResultadoRef = useRef<ResultadoAlta | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!esOrigenDeMeta(event.origin)) return;

      const resultado = interpretarMensajeDeAlta(event.data);
      if (resultado.tipo === "ignorar") return;

      // Se guarda el ultimo resultado, sea cual sea. Antes solo se guardaba el
      // caso perfecto y los demas se perdian: el usuario terminaba el alta y
      // veia "se cancelo la conexion" sin mas explicacion.
      ultimoResultadoRef.current = resultado;

      if (resultado.tipo === "listo") {
        signupDataRef.current = {
          waba_id: resultado.wabaId,
          phone_number_id: resultado.phoneNumberId,
        };
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function launchSignup() {
    if (!window.FB) return;
    setStatus("connecting");
    setMessage(null);

    async function handleLoginResponse(response: {
      authResponse?: { code?: string };
      status?: string;
    }) {
      const code = response.authResponse?.code;
      const signupData = signupDataRef.current;

      if (!code || !signupData) {
        setStatus("error");
        // El mensaje sale de lo que Meta dijo de verdad, no de una suposicion.
        setMessage(
          mensajeDeAlta(ultimoResultadoRef.current ?? { tipo: "ignorar" })
        );
        return;
      }

      const result = await connectWhatsApp({
        code,
        wabaId: signupData.waba_id,
        phoneNumberId: signupData.phone_number_id,
        label: channelLabel,
      });

      if ("error" in result) {
        setStatus("error");
        setMessage(result.error ?? "Ocurrió un error inesperado.");
        return;
      }

      setStatus("success");
      setMessage(`Conectado: ${result.displayPhoneNumber}`);
      router.refresh();
    }

    window.FB.login(
      (response) => {
        void handleLoginResponse(response);
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: "3" },
      }
    );
  }

  return (
    <>
      <Script
        id="facebook-jssdk-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.fbAsyncInit = function() {
              window.FB.init({
                appId: '${process.env.NEXT_PUBLIC_META_APP_ID}',
                autoLogAppEvents: true,
                xfbml: true,
                version: 'v21.0'
              });
            };
          `,
        }}
      />
      <Script
        id="facebook-jssdk"
        src="https://connect.facebook.net/es_LA/sdk.js"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
      />

      {askLabel && (
        <input
          type="text"
          value={channelLabel}
          onChange={(e) => setChannelLabel(e.target.value)}
          placeholder="Nombre de este canal (ej: Ventas, Soporte)"
          className="mt-4 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      )}

      <button
        type="button"
        onClick={launchSignup}
        disabled={disabled || !sdkReady || status === "connecting"}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {status === "connecting" ? "Conectando..." : label}
      </button>

      {message && (
        <p
          className={`mt-3 text-sm ${
            status === "error" ? "text-red-400" : "text-success"
          }`}
        >
          {message}
        </p>
      )}
    </>
  );
}
