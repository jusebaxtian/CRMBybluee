"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// Synthesizes a short two-tone "ding" via the Web Audio API — no external
// audio file to host, and it sidesteps browser autoplay restrictions better
// than <audio>, since it's triggered directly from a user-initiated context
// (the realtime event still requires a prior user gesture on the page, which
// logging in / clicking around already provides).
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const notes: [number, number][] = [
    [880, now],
    [1174.66, now + 0.09],
  ];

  for (const [freq, start] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  }
}

// Deliberately different from playChime: a sawtooth (harsher timbre than the
// sine "ding"), three short repeated beeps instead of two rising notes, and
// louder — meant to stand out as "stop and look" rather than "new message",
// since this only fires when the AI hands a chat off and needs a human now.
function playAlert(ctx: AudioContext) {
  const now = ctx.currentTime;
  const beepStarts = [now, now + 0.18, now + 0.36];

  for (const start of beepStarts) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.28, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  }
}

export function InboundMessageSound() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    function ensureContext() {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      return audioCtxRef.current;
    }

    // Browsers require a user gesture before audio can play; this primes the
    // AudioContext on the first click/keypress anywhere on the page.
    function unlock() {
      const ctx = ensureContext();
      if (ctx.state === "suspended") ctx.resume();
    }
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      // No filter: RLS already scopes which message rows this connection can
      // see to the caller's own workspace(s).
      channel = supabase
        .channel("inbound-message-sound")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as { direction?: string };
            if (row.direction !== "in") return;
            try {
              const ctx = ensureContext();
              if (ctx.state === "suspended") ctx.resume();
              playChime(ctx);
            } catch {
              // Autoplay blocked (no user gesture yet) — silently skip.
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversations" },
          (payload) => {
            const before = payload.old as { ai_handoff_requested?: boolean };
            const after = payload.new as { ai_handoff_requested?: boolean };
            // Only the false → true transition — an update caused by clearing
            // the handoff (or any unrelated column change) must stay silent.
            if (before.ai_handoff_requested === true || after.ai_handoff_requested !== true) return;
            try {
              const ctx = ensureContext();
              if (ctx.state === "suspended") ctx.resume();
              playAlert(ctx);
            } catch {
              // Autoplay blocked (no user gesture yet) — silently skip.
            }
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
