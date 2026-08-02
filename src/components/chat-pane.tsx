"use client";

import { useEffect, useState } from "react";
import { MessagesScrollArea } from "@/components/messages-scroll-area";
import { MessageComposer } from "@/components/message-composer";
import { TemplateGatePicker } from "@/components/template-gate-picker";
import { useMessageWindow } from "@/lib/use-message-window";

export type OptimisticMessage = {
  id: string;
  direction: string;
  body: string | null;
  status: string;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  error_detail?: string | null;
  created_at: string;
};

type ApprovedTemplate = { id: string; meta_template_name: string; language: string; body_text: string | null };

export function ChatPane({
  conversationId,
  contactId,
  messages,
  quickReplies = [],
  approvedTemplates = [],
}: {
  conversationId: string;
  contactId: string;
  messages: OptimisticMessage[];
  quickReplies?: { id: string; name: string }[];
  approvedTemplates?: ApprovedTemplate[];
}) {
  const [pending, setPending] = useState<OptimisticMessage[]>([]);

  // Once the server list changes (a realtime refresh landed), the message we
  // optimistically added is now included for real — drop the local copy.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPending([]), [messages.length]);

  const combined = [...messages, ...pending];

  // WhatsApp only allows free-form messages within 24h of the contact's last
  // inbound message — derived from the live message list so it updates the
  // instant a new inbound message arrives via realtime, no reload needed.
  const lastInboundAt = combined
    .filter((m) => m.direction === "in")
    .reduce<string | null>((latest, m) => (!latest || m.created_at > latest ? m.created_at : latest), null);
  const { open: windowOpen } = useMessageWindow(lastInboundAt);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <MessagesScrollArea messages={combined} />
      {windowOpen ? (
        <MessageComposer
          conversationId={conversationId}
          contactId={contactId}
          quickReplies={quickReplies}
          onOptimisticSend={(message) => setPending((p) => [...p, message])}
        />
      ) : (
        <TemplateGatePicker conversationId={conversationId} templates={approvedTemplates} />
      )}
    </div>
  );
}
