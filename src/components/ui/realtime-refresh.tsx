"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { refrescoTermino, registrarRunner, solicitarRefresco } from "@/lib/realtime/refresco-coordinado";

// Cuanto esperar antes de refrescar segun lo que cambio. Un mensaje nuevo
// se quiere ver ya; un cambio de estado (enviado -> entregado -> leido) puede
// esperar y agruparse con los que vienen detras.
function retrasoPara(table: string, eventType: string): number {
  if (eventType === "INSERT" || eventType === "DELETE") return 200;
  if (table === "messages") return 1500;
  return 500;
}

// Subscribes to Postgres changes on a table (optionally filtered) and
// refreshes the current server-rendered page shortly after any change,
// so the inbox/chat updates live instead of requiring a manual reload.
// Todos los suscriptores de la pagina comparten un unico refresh
// (ver refresco-coordinado.ts).
export function RealtimeRefresh({
  table,
  filter,
  channelName,
}: {
  table: string;
  filter?: string;
  channelName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const corriendo = useRef(false);

  // Este componente ofrece su transicion como "runner"; el coordinador usa
  // uno cualquiera de los montados.
  useEffect(() => {
    return registrarRunner(() => {
      corriendo.current = true;
      startTransition(() => router.refresh());
    });
  }, [router, startTransition]);

  useEffect(() => {
    if (!isPending && corriendo.current) {
      corriendo.current = false;
      refrescoTermino();
    }
  }, [isPending]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let reintento: ReturnType<typeof setTimeout> | null = null;
    let espera = 1000;

    // RLS-gated postgres_changes broadcasts require the realtime socket to
    // carry the user's JWT — attach it before subscribing, otherwise the
    // channel joins fine but every row change gets silently filtered out.
    //
    // Y hay que MANTENERLO fresco: el token dura 1 hora. Si solo se entrega
    // al montar, cuando se renueva (o el equipo se suspende) el socket sigue
    // con el token viejo, el servidor deja de enviar cambios y la bandeja se
    // queda congelada hasta recargar a mano.
    async function conectar() {
      if (cancelled) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      if (channel) supabase.removeChannel(channel);
      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, (payload) => {
          solicitarRefresco(retrasoPara(table, payload.eventType));
        })
        .subscribe((estado) => {
          if (estado === "SUBSCRIBED") {
            espera = 1000;
            return;
          }
          // El canal se cayo (token vencido, red, servidor reiniciado):
          // se vuelve a conectar con espera creciente hasta 30 s.
          if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
            reconectar();
          }
        });
    }

    function reconectar() {
      if (cancelled || reintento) return;
      reintento = setTimeout(() => {
        reintento = null;
        espera = Math.min(espera * 2, 30000);
        void conectar();
      }, espera);
    }

    void conectar();

    // Token renovado: el socket tiene que enterarse o deja de recibir.
    const { data: authSub } = supabase.auth.onAuthStateChange((evento, session) => {
      if (cancelled) return;
      if ((evento === "TOKEN_REFRESHED" || evento === "SIGNED_IN") && session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    // Red de seguridad para portatil que despierta o WiFi que se cae: al
    // volver, se reconecta y se pide un refresco por si llegaron mensajes
    // mientras tanto. No hay consultas periodicas: solo en estos eventos.
    function alVolver() {
      if (cancelled || (document.visibilityState !== "visible" && navigator.onLine === false)) return;
      const estado = channel?.state;
      if (estado !== "joined") {
        espera = 1000;
        void conectar();
      }
      solicitarRefresco(300);
    }
    function alCambiarVisibilidad() {
      if (document.visibilityState === "visible") alVolver();
    }
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("online", alVolver);
    window.addEventListener("focus", alCambiarVisibilidad);

    return () => {
      cancelled = true;
      if (reintento) clearTimeout(reintento);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("online", alVolver);
      window.removeEventListener("focus", alCambiarVisibilidad);
      authSub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, channelName]);

  return null;
}
