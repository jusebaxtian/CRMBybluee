"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageBubble } from "@/components/message-bubble";
import { PullToRefresh } from "@/components/pull-to-refresh";

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

export function MessagesScrollArea({
  messages,
  onReply,
}: {
  messages: Message[];
  onReply?: (target: { waMessageId: string; preview: string }) => void;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId]);

  return (
    // pl-16 reserves a gutter for the floating attach/quick-reply/mic cluster
    // pinned to the left edge (see MessageComposer), so message bubbles never
    // render underneath it.
    <PullToRefresh className="flex-1 space-y-3 py-3 pl-16 pr-3 sm:py-5 sm:pl-16 sm:pr-5">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          quotedMessage={m.context_wa_message_id ? byWaMessageId.get(m.context_wa_message_id) ?? null : null}
          onReply={onReply}
        />
      ))}
      <div ref={bottomRef} />
    </PullToRefresh>
  );
}
