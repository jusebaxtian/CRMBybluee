"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { playChime } from "@/lib/sound/chime";

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

type Props = {
  workspaceId?: string | null;
  isPlatformAdmin?: boolean;
  isImpersonating?: boolean;
};

// A platform admin's RLS lets them see every workspace's messages, so with
// no scoping here they'd hear a chime for every client's inbound message,
// all the time — not just the one they're actively viewing in "modo
// soporte". A regular client only ever has one workspace, so this stays a
// no-op for them.
export function InboundMessageSound({
  workspaceId = null,
  isPlatformAdmin = false,
  isImpersonating = false,
}: Props) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // An admin browsing their own dashboard (not "modo soporte" on a
    // specific client) gets no sound at all — there's no single workspace
    // to scope it to, and playing for every client at once is the exact
    // complaint being fixed here.
    if (isPlatformAdmin && !isImpersonating) return;

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

    // messages doesn't carry workspace_id itself (only conversation_id), so
    // scoping to "the workspace currently open in modo soporte" needs one
    // extra lookup per inbound row — cheap at chat-message frequency, and
    // the only way to keep an admin's sound to the client they're actually
    // viewing instead of every workspace RLS lets them see.
    async function belongsToCurrentWorkspace(conversationId: string): Promise<boolean> {
      if (!workspaceId) return false;
      const { data } = await supabase
        .from("conversations")
        .select("workspace_id")
        .eq("id", conversationId)
        .maybeSingle();
      return data?.workspace_id === workspaceId;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      // No table-level filter: RLS scopes which message rows a regular
      // client's connection can see to their own workspace, but a platform
      // admin can see every workspace's rows — belongsToCurrentWorkspace()
      // below is what actually narrows it down for them.
      channel = supabase
        .channel("inbound-message-sound")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            const row = payload.new as { direction?: string; conversation_id?: string };
            if (row.direction !== "in") return;
            if (isPlatformAdmin) {
              if (!row.conversation_id || !(await belongsToCurrentWorkspace(row.conversation_id))) {
                return;
              }
            }
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
            const after = payload.new as { ai_handoff_requested?: boolean; workspace_id?: string };
            // Only the false → true transition — an update caused by clearing
            // the handoff (or any unrelated column change) must stay silent.
            if (before.ai_handoff_requested === true || after.ai_handoff_requested !== true) return;
            // conversations carries workspace_id on the row itself, no extra
            // lookup needed here unlike the messages case above.
            if (isPlatformAdmin && after.workspace_id !== workspaceId) return;
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
  }, [workspaceId, isPlatformAdmin, isImpersonating]);

  return null;
}
