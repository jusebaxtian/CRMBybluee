"use client";

import { useEffect, useState } from "react";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * WhatsApp only allows free-form messages within 24h of the contact's last
 * inbound message — outside that window only template messages work. This
 * ticks every second so both the header countdown and the composer's gate
 * stay in sync and flip live, without a page refresh, right when it expires.
 */
export function useMessageWindow(lastInboundAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!lastInboundAt) {
    return { open: false, msRemaining: 0, expiresAt: null as Date | null };
  }

  const expiresAt = new Date(new Date(lastInboundAt).getTime() + WINDOW_MS);
  const msRemaining = expiresAt.getTime() - now;

  return { open: msRemaining > 0, msRemaining, expiresAt };
}
