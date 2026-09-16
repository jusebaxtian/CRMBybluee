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

    // RLS-gated postgres_changes broadcasts require the realtime socket to
    // carry the user's JWT — attach it before subscribing, otherwise the
    // channel joins fine but every row change gets silently filtered out.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, (payload) => {
          solicitarRefresco(retrasoPara(table, payload.eventType));
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter, channelName]);

  return null;
}
