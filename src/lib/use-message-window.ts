"use client";

import { useEffect, useState } from "react";
import { isWindowOpen, msRemainingInWindow, windowExpiresAt } from "@/lib/whatsapp/message-window";

/**
 * Estado en vivo de la ventana de 24 horas de WhatsApp.
 *
 * La regla en si vive en lib/whatsapp/message-window; aqui solo se le pone el
 * reloj. Avanza cada segundo para que la cuenta regresiva del encabezado y el
 * bloqueo del compositor cambien solos en el momento exacto en que expira, sin
 * recargar la pagina.
 */
export function useMessageWindow(lastInboundAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return {
    open: isWindowOpen(lastInboundAt, now),
    msRemaining: msRemainingInWindow(lastInboundAt, now),
    expiresAt: windowExpiresAt(lastInboundAt),
  };
}
