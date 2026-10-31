"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageBubble } from "@/components/inbox/message-bubble";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { reaccionesPorMensaje } from "@/lib/inbox/reacciones";

type Message = {
  id: string;
  direction: string;
  body: string | null;
  caption?: string | null;
  status: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  error_detail?: string | null;
  wa_message_id?: string | null;
  context_wa_message_id?: string | null;
  sent_from_app?: boolean | null;
  buttons?: ({ type: "QUICK_REPLY"; id: string; title: string } | { type: "URL"; title: string; url: string })[] | null;
  created_at: string;
};


/** Dia del mensaje en hora de Colombia, como "2026-09-25". */
function diaDe(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/**
 * Titulo del dia, como en WhatsApp (decision del 31 oct 2026): "Hoy", "Ayer",
 * el dia de la semana si fue hace menos de una semana ("Miércoles"), y si no
 * la fecha ("15 de octubre"; con el año si es de otro año). Se usa en los
 * separadores y en la fecha fija de arriba.
 */
function tituloDelDia(iso: string): string {
  const dia = diaDe(iso);
  const hoy = diaDe(new Date().toISOString());
  const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / 86_400_000);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";

  const fecha = new Date(iso);
  if (dias < 7) {
    const nombre = fecha.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long" });
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }
  const mismoAno = dia.slice(0, 4) === hoy.slice(0, 4);
  return fecha.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    ...(mismoAno ? {} : { year: "numeric" }),
  });
}

/** Cuanto queda visible la fecha fija despues de dejar de mover el chat. */
const FECHA_FIJA_MS = 3000;

function SeparadorDeFecha({ iso }: { iso: string }) {
  return (
    <div className="flex items-center justify-center py-1">
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-muted shadow-sm">
        {tituloDelDia(iso)}
      </span>
    </div>
  );
}

export function MessagesScrollArea({
  messages,
  hayMasAntiguos,
  onReply,
  onForward,
  onRegistrarPago,
}: {
  messages: Message[];
  hayMasAntiguos?: boolean;
  onReply?: (target: { waMessageId: string; preview: string }) => void;
  onForward?: (target: { messageId: string; preview: string }) => void;
  onRegistrarPago?: (target: { messageId: string; preview: string }) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  // Looks up the quoted/reacted-to message by wa_message_id so bubbles can
  // show a small preview of what a reply or reaction actually refers to.
  const byWaMessageId = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) {
      if (m.wa_message_id) map.set(m.wa_message_id, m);
    }
    return map;
  }, [messages]);

  // Las reacciones se pintan sobre el mensaje reaccionado, no como filas aparte.
  const reacciones = useMemo(() => reaccionesPorMensaje(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
     
  }, [lastMessageId]);

  // Fecha fija arriba, como WhatsApp: al mover el chat muestra el dia de los
  // mensajes que estan arriba en pantalla y se esconde a los 3 s sin moverlo.
  const [fechaFija, setFechaFija] = useState<string | null>(null);
  const [fechaVisible, setFechaVisible] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alMover = useCallback((contenedor: HTMLDivElement) => {
    const arriba = contenedor.getBoundingClientRect().top + 8;
    for (const el of contenedor.querySelectorAll<HTMLElement>("[data-dia]")) {
      if (el.getBoundingClientRect().bottom > arriba) {
        setFechaFija(tituloDelDia(el.dataset.dia as string));
        break;
      }
    }
    setFechaVisible(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setFechaVisible(false), FECHA_FIJA_MS);
  }, []);
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
    {fechaFija && (
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-2 z-10 rounded-[8px] border border-border bg-surface px-3 py-1 text-[11.5px] font-semibold text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-all duration-200 sm:top-3 ${
          fechaVisible ? "-translate-x-1/2 translate-y-0 opacity-100" : "-translate-x-1/2 -translate-y-1.5 opacity-0"
        }`}
      >
        {fechaFija}
      </div>
    )}
    {/* pl-16 reserves a gutter for the floating attach/quick-reply/mic cluster
        pinned to the left edge (see MessageComposer), so message bubbles never
        render underneath it. */}
    <PullToRefresh onScroll={alMover} className="flex-1 space-y-3 py-3 pl-16 pr-3 sm:py-5 sm:pl-16 sm:pr-5">
      {/* Se dice en pantalla en vez de recortar en silencio: antes la
          conversacion simplemente se quedaba quieta y nadie sabia por que. */}
      {hayMasAntiguos && (
        <p className="pb-1 text-center text-[11px] text-muted">
          Se muestran los mensajes más recientes de esta conversación.
        </p>
      )}
      {messages.map((m, i) => {
        // Un separador cada vez que cambia el dia respecto al mensaje anterior.
        const cambiaDeDia = i === 0 || diaDe(m.created_at) !== diaDe(messages[i - 1].created_at);
        const reaccionYaPintada =
          m.message_type === "reaction" && !!m.context_wa_message_id && byWaMessageId.has(m.context_wa_message_id);
        // Sin fila ni separador que mostrar: no se deja un hueco vacio entre mensajes.
        if (reaccionYaPintada && !cambiaDeDia) return null;
        return (
          <div key={m.id} data-dia={m.created_at} className="space-y-3">
            {cambiaDeDia && <SeparadorDeFecha iso={m.created_at} />}
            {/* Una reaccion cuyo mensaje esta en pantalla ya se ve como emoji sobre el; si el
                mensaje es mas antiguo que lo cargado, se deja la fila de texto como respaldo. */}
            {!reaccionYaPintada && (
              <MessageBubble
                message={m}
                quotedMessage={m.context_wa_message_id ? byWaMessageId.get(m.context_wa_message_id) ?? null : null}
                reacciones={m.wa_message_id ? reacciones.get(m.wa_message_id) : undefined}
                onReply={onReply}
                onForward={onForward}
                onRegistrarPago={onRegistrarPago}
              />
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </PullToRefresh>
    </div>
  );
}
