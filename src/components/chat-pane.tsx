"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { MessagesScrollArea } from "@/components/messages-scroll-area";
import { MessageComposer, type MessageComposerHandle } from "@/components/message-composer";
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
  wa_message_id?: string | null;
  context_wa_message_id?: string | null;
  buttons?: ({ type: "QUICK_REPLY"; id: string; title: string } | { type: "URL"; title: string; url: string })[] | null;
  created_at: string;
};

type ApprovedTemplate = { id: string; meta_template_name: string; language: string; body_text: string | null };

export function ChatPane({
  conversationId,
  contactId,
  messages,
  quickReplies = [],
  automations = [],
  approvedTemplates = [],
}: {
  conversationId: string;
  contactId: string;
  messages: OptimisticMessage[];
  quickReplies?: { id: string; name: string }[];
  automations?: { id: string; name: string }[];
  approvedTemplates?: ApprovedTemplate[];
}) {
  const [pending, setPending] = useState<OptimisticMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ waMessageId: string; preview: string } | null>(null);
  const composerRef = useRef<MessageComposerHandle>(null);
  const [dragActive, setDragActive] = useState(false);
  // Counts nested dragenter/dragleave pairs (messages, bubbles, etc. all
  // fire their own) so the overlay doesn't flicker off until the drag
  // actually leaves the whole pane, not just a child element.
  const dragCounter = useRef(0);

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

  function handleDragEnter(e: React.DragEvent) {
    if (!windowOpen) return;
    // Only react to actual files being dragged, not text/links.
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragCounter.current += 1;
    setDragActive(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!windowOpen) return;
    e.preventDefault();
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!windowOpen) return;
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    if (!windowOpen) return;
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    for (const file of e.dataTransfer.files) {
      composerRef.current?.enqueueUpload(file);
    }
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 border-4 border-dashed border-primary bg-background/90">
          <Paperclip size={28} className="text-primary" />
          <p className="text-sm font-medium text-foreground">Suelta el archivo para adjuntarlo</p>
        </div>
      )}
      <MessagesScrollArea messages={combined} onReply={setReplyingTo} />
      {windowOpen ? (
        <MessageComposer
          ref={composerRef}
          conversationId={conversationId}
          contactId={contactId}
          quickReplies={quickReplies}
          automations={automations}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
          onOptimisticSend={(message) => setPending((p) => [...p, message])}
        />
      ) : (
        <TemplateGatePicker conversationId={conversationId} templates={approvedTemplates} />
      )}
    </div>
  );
}
