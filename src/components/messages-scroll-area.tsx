"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/message-bubble";

type Message = {
  id: string;
  direction: string;
  body: string | null;
  status: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  created_at: string;
};

export function MessagesScrollArea({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageId]);

  return (
    // pl-16 reserves a gutter for the floating attach/quick-reply/mic cluster
    // pinned to the left edge (see MessageComposer), so message bubbles never
    // render underneath it.
    <div className="flex-1 space-y-3 overflow-y-auto py-3 pl-16 pr-3 sm:py-5 sm:pl-16 sm:pr-5">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
