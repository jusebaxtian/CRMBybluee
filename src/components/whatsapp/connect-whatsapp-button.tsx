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
type Modo = "api" | "coexistencia";

// Lo que Meta limita en un numero que sigue vivo en la app WhatsApp Business.
// Se muestra ANTES de conectar: la persona tiene que saberlo y aceptarlo.
const ADVERTENCIAS_COEXISTENCIA = [
  "El envío masivo queda limitado a 20 mensajes por segundo.",
  "Los grupos no se sincronizan con el CRM.",
  "Se desactivan los mensajes temporales, los de «ver una vez», la ubicación en vivo y las listas de difusión de la app.",
  "En la app Business dejan de funcionar las llamadas y los canales. WhatsApp para Windows no funciona, y los dispositivos vinculados se desvinculan: hay que volver a vincularlos.",
  "Lo que escribas desde el celular no abre la ventana de 24 horas del CRM: solo la abren los mensajes enviados desde el CRM.",
  "Se importan los contactos y los últimos 30 días de chats (en esa primera sincronización; no se repite).",
  "Cuando respondas desde el celular, el agente de IA se pausa en ese chat; lo reanudas desde el CRM.",
  "Para desconectar del todo, hazlo desde la app WhatsApp Business. Quitar el número en el CRM no libera la app.",
  "Necesitas la app WhatsApp Business actualizada y el celular a mano para escanear un código QR.",
];

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
  coexistencia = false,
}: {
  /** Ofrece elegir entre "número nuevo (API)" y "coexistencia". Sin esto, conecta como siempre. */
  coexistencia?: boolean;
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
  const [paso, setPaso] = useState<"cerrado" | "elegir" | "advertencias">("cerrado");
  const [acepto, setAcepto] = useState(false);
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
        // Coexistencia: Meta avisa la cuenta (WABA); el numero se busca en el servidor.
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
          signupDataRef.current = {
            waba_id: data.data.waba_id,
            phone_number_id: data.data.phone_number_id ?? "",
          };
        }
      } catch {
        // Ignore non-JSON messages from other sources.
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function launchSignup(modo: Modo = "api") {
    if (!window.FB) return;
    setPaso("cerrado");
    setStatus("connecting");
    setMessage(null);
    signupDataRef.current = null;

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
          modo,
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
      setMessage(
        modo === "coexistencia"
          ? `Conectado en coexistencia: ${result.displayPhoneNumber}. Estamos trayendo tus contactos y los últimos 30 días de chats.`
          : `Conectado: ${result.displayPhoneNumber}`
      );
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
        extras:
          modo === "coexistencia"
            ? { sessionInfoVersion: "3", featureType: "whatsapp_business_app_onboarding" }
            : { sessionInfoVersion: "3" },
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
        onClick={() => {
          setAcepto(false);
          if (coexistencia) setPaso("elegir");
          else launchSignup("api");
        }}
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

      {paso !== "cerrado" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cómo quieres conectar tu número"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPaso("cerrado")}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] border border-border bg-surface p-5 text-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {paso === "elegir" ? (
              <>
                <p className="text-base font-semibold">¿Cómo quieres conectar tu número?</p>
                <div className="mt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => launchSignup("api")}
                    className="rounded-[12px] border border-border p-4 text-left hover:border-primary hover:bg-surface-hover"
                  >
                    <p className="text-sm font-semibold">Número nuevo (solo API)</p>
                    <p className="mt-1 text-[13px] text-muted">
                      El número vive solo en el CRM. No se usa en la app WhatsApp del celular. Es la forma de siempre.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaso("advertencias")}
                    className="rounded-[12px] border border-border p-4 text-left hover:border-primary hover:bg-surface-hover"
                  >
                    <p className="text-sm font-semibold">Coexistencia: mi número de la app WhatsApp Business</p>
                    <p className="mt-1 text-[13px] text-muted">
                      Sigues usando el número en tu celular y también en el CRM. Trae tus contactos y los últimos 30 días
                      de chats.
                    </p>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPaso("cerrado")}
                  className="mt-4 text-[13px] text-muted underline hover:text-foreground"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">Antes de conectar en coexistencia</p>
                <p className="mt-1 text-[13px] text-muted">Meta aplica estas condiciones a un número que sigue en la app WhatsApp Business:</p>
                <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[13px]">
                  {ADVERTENCIAS_COEXISTENCIA.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <label className="mt-4 flex items-start gap-2 text-[13px]">
                  <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5" />
                  Entiendo estas condiciones y quiero conectar en coexistencia.
                </label>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!acepto}
                    onClick={() => launchSignup("coexistencia")}
                    className="rounded-[10px] bg-primary px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    Continuar
                  </button>
                  <button type="button" onClick={() => setPaso("elegir")} className="text-[13px] text-muted underline hover:text-foreground">
                    Volver
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
