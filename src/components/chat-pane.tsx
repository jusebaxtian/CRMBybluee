"use client";

import { useEffect, useState } from "react";
import { MessagesScrollArea } from "@/components/messages-scroll-area";
import { MessageComposer } from "@/components/message-composer";

export type OptimisticMessage = {
  id: string;
  direction: string;
  body: string | null;
  status: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  created_at: string;
};

export function ChatPane({
  conversationId,
  messages,
}: {
  conversationId: string;
  messages: OptimisticMessage[];
}) {
  const [pending, setPending] = useState<OptimisticMessage[]>([]);

  // Once the server list changes (a realtime refresh landed), the message we
  // optimistically added is now included for real — drop the local copy.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPending([]), [messages.length]);

  const combined = [...messages, ...pending];

  return (
    <>
      <MessagesScrollArea messages={combined} />
      <MessageComposer
        conversationId={conversationId}
        onOptimisticSend={(message) => setPending((p) => [...p, message])}
      />
    </>
  );
}
