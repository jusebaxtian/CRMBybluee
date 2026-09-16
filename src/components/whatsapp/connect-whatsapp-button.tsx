"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { connectWhatsApp } from "@/app/actions/whatsapp";

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

function detectarEntorno(ua: string): "normal" | "embebido" | "movil" {
  const embebido =
    /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|; wv\)|WebView/i.test(ua) || (/iPhone|iPad/.test(ua) && !/Safari/.test(ua));
  const movil = /Android|iPhone|iPad|iPod/i.test(ua);
  return embebido ? "embebido" : movil ? "movil" : "normal";
}

export function ConnectWhatsAppButton({
  label = "Conectar WhatsApp",
  askLabel = false,
  disabled = false,
  className,
}: {
  label?: string;
  /** Sustituye el estilo del boton; el dashboard lo viste con su propio diseño. */
  className?: string;
  /** Show a "nombre de este canal" field (Ventas, Soporte…) before connecting — used once a workspace already has one number and is adding another. */
  askLabel?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  // Navegador embebido (abrir el CRM desde un enlace en WhatsApp, Instagram o
  // Facebook): no puede abrir la ventana emergente de Meta, asi que el
  // proceso "termina" en Meta pero nunca vuelve al CRM y no se guarda nada.
  // Se detecta al montar y se guia a la persona a abrirlo en el navegador.
  // useSyncExternalStore: en el servidor "normal" y en el cliente el valor
  // real, sin desajuste de hidratacion ni setState en un efecto.
  const entorno = useSyncExternalStore(
    () => () => {},
    () => detectarEntorno(navigator.userAgent),
    () => "normal" as const
  );
  const [copiado, setCopiado] = useState(false);

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }
  const [channelLabel, setChannelLabel] = useState("");
  const signupDataRef = useRef<SignupData | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
          signupDataRef.current = {
            waba_id: data.data.waba_id,
            phone_number_id: data.data.phone_number_id,
          };
        }
      } catch {
        // Ignore non-JSON messages from other sources.
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
        setMessage("Se canceló la conexión o no se recibió la información esperada.");
        return;
      }

      let result: Awaited<ReturnType<typeof connectWhatsApp>>;
      try {
        result = await connectWhatsApp({
          code,
          wabaId: signupData.waba_id,
          phoneNumberId: signupData.phone_number_id,
          label: channelLabel,
        });
      } catch (err) {
        // Si la plataforma se desplegó mientras esta pestaña estaba abierta,
        // el id de la acción de servidor ya no existe y Next responde 404
        // ("Server action not found."). Antes esto quedaba sin capturar: el
        // botón se quedaba en "Conectando…" para siempre y el usuario volvía
        // a intentar sin éxito. Se avisa y se recarga para que el siguiente
        // intento salga con el código nuevo.
        const texto = err instanceof Error ? err.message : String(err);
        const desplegado = /server action not found|older or newer deployment/i.test(texto);
        setStatus("error");
        setMessage(
          desplegado
            ? "La plataforma se actualizó mientras tenías esta página abierta. Se recargará en unos segundos; vuelve a pulsar Conectar."
            : "No se pudo completar la conexión. Recarga la página e intenta de nuevo."
        );
        if (desplegado) setTimeout(() => window.location.reload(), 3000);
        return;
      }

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
          className="mt-4 w-full max-w-xs rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
        />
      )}

      {entorno === "embebido" && (
        <div className="mt-3 rounded-[10px] border border-warning/40 bg-warning/10 p-3 text-[13px] text-foreground">
          <p className="font-semibold text-warning">Abre esta página en tu navegador para conectar</p>
          <p className="mt-1 text-muted">
            Estás dentro de una app (WhatsApp, Instagram o Facebook) y Meta no puede abrir aquí la ventana de
            conexión: el proceso parece terminar pero no se guarda. Copia el enlace y ábrelo en Chrome o Safari, o
            hazlo desde un computador.
          </p>
          <button
            type="button"
            onClick={copiarEnlace}
            className="mt-2 rounded-[9px] border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
          >
            {copiado ? "Enlace copiado ✓" : "Copiar enlace"}
          </button>
        </div>
      )}
      {entorno === "movil" && (
        <p className="mt-3 text-[12px] text-muted">
          Desde el celular funciona en Chrome o Safari. Si la ventana de Meta no se abre o al volver no aparece el
          número, conéctalo desde un computador.
        </p>
      )}

      <button
        type="button"
        onClick={launchSignup}
        disabled={disabled || !sdkReady || status === "connecting" || entorno === "embebido"}
        className={
          className ??
          "mt-3 rounded-[10px] bg-primary px-4 py-[10px] text-[12.5px] font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        }
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
