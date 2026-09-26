"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageBubble } from "@/components/inbox/message-bubble";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

type Message = {
  id: string;
  direction: string;
  body: string | null;
  status: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  error_detail?: string | null;
  wa_message_id?: string | null;
  context_wa_message_id?: string | null;
  buttons?: ({ type: "QUICK_REPLY"; id: string; title: string } | { type: "URL"; title: string; url: string })[] | null;
  created_at: string;
};


/** Dia del mensaje en hora de Colombia, como "2026-09-25". */
function diaDe(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/**
 * Titulo del separador: "Hoy", "Ayer" o la fecha escrita. Asi se sabe de
 * cuando es cada parte de la conversacion sin abrir cada mensaje.
 */
function tituloDelDia(iso: string): string {
  const dia = diaDe(iso);
  const hoy = diaDe(new Date().toISOString());
  const ayer = diaDe(new Date(Date.now() - 86_400_000).toISOString());
  if (dia === hoy) return "Hoy";
  if (dia === ayer) return "Ayer";

  const fecha = new Date(iso);
  const mismoAno = fecha.getFullYear() === new Date().getFullYear();
  return fecha.toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(mismoAno ? {} : { year: "numeric" }),
  });
}

function SeparadorDeFecha({ iso }: { iso: string }) {
  return (
    <div className="flex items-center justify-center py-1">
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold capitalize text-muted shadow-sm">
        {tituloDelDia(iso)}
      </span>
    </div>
  );
}

export function MessagesScrollArea({
  messages,
  onReply,
  onForward,
  onRegistrarPago,
}: {
  messages: Message[];
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
     
  }, [lastMessageId]);

  return (
    // pl-16 reserves a gutter for the floating attach/quick-reply/mic cluster
    // pinned to the left edge (see MessageComposer), so message bubbles never
    // render underneath it.
    <PullToRefresh className="flex-1 space-y-3 py-3 pl-16 pr-3 sm:py-5 sm:pl-16 sm:pr-5">
      {messages.map((m, i) => {
        // Un separador cada vez que cambia el dia respecto al mensaje anterior.
        const cambiaDeDia = i === 0 || diaDe(m.created_at) !== diaDe(messages[i - 1].created_at);
        return (
          <div key={m.id} className="space-y-3">
            {cambiaDeDia && <SeparadorDeFecha iso={m.created_at} />}
            <MessageBubble
              message={m}
              quotedMessage={m.context_wa_message_id ? byWaMessageId.get(m.context_wa_message_id) ?? null : null}
              onReply={onReply}
              onForward={onForward}
              onRegistrarPago={onRegistrarPago}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </PullToRefresh>
  );
}
