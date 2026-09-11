"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Subscribes to Postgres changes on a table (optionally filtered) and
// refreshes the current server-rendered page shortly after any change,
// so the inbox/chat updates live instead of requiring a manual reload.
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter },
          () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => router.refresh(), 250);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, channelName]);

  return null;
}
