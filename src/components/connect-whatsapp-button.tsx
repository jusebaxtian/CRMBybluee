"use client";

import { useEffect, useRef, useState } from "react";
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

export function ConnectWhatsAppButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
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

      const result = await connectWhatsApp({
        code,
        wabaId: signupData.waba_id,
        phoneNumberId: signupData.phone_number_id,
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

      <button
        type="button"
        onClick={launchSignup}
        disabled={!sdkReady || status === "connecting"}
        className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {status === "connecting" ? "Conectando..." : "Conectar WhatsApp"}
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
