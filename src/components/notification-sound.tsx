"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { playChime } from "@/lib/sound/chime";

type Props = {
  workspaceId: string | null;
  planId: string | null;
  workspaceStatus: string | null;
};

// Plays the same "new item" chime as an inbound WhatsApp message whenever a
// platform notification that applies to this workspace arrives live, and
// refreshes the page so the bell (server-rendered) picks it up immediately —
// same trick for a delete, so an admin removing a notification makes it
// disappear from an already-open dashboard instead of lingering until the
// next navigation.
export function NotificationSound({ workspaceId, planId, workspaceStatus }: Props) {
  const router = useRouter();
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    function ensureContext() {
      if (!audioCtxRef.current) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      return audioCtxRef.current;
    }

    function unlock() {
      const ctx = ensureContext();
      if (ctx.state === "suspended") ctx.resume();
    }
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Realtime carries no OR-filter support, so the applies-to-me check
    // (mirrors the scope filter in dashboard/layout.tsx) happens client-side.
    function appliesToMe(row: {
      scope?: string;
      target_workspace_id?: string | null;
      target_plan_id?: string | null;
      target_status?: string | null;
    }) {
      if (row.scope === "all") return true;
      if (row.scope === "workspace") return row.target_workspace_id === workspaceId;
      if (row.scope === "plan") return !!planId && row.target_plan_id === planId;
      if (row.scope === "status") return !!workspaceStatus && row.target_status === workspaceStatus;
      return false;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel("notification-sound")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            if (!appliesToMe(payload.new as never)) return;
            try {
              const ctx = ensureContext();
              if (ctx.state === "suspended") ctx.resume();
              playChime(ctx);
            } catch {
              // Autoplay blocked (no user gesture yet) — silently skip.
            }
            router.refresh();
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "notifications" },
          () => {
            // We don't get the deleted row's scope back on DELETE — just
            // refresh, the server query naturally drops it if it's gone.
            router.refresh();
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
  }, [workspaceId, planId, workspaceStatus, router]);

  return null;
}
