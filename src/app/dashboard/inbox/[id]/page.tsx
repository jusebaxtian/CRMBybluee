import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MessageComposer } from "@/components/message-composer";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, contacts(name, wa_id)")
    .eq("id", id)
    .maybeSingle();

  if (!conversation) notFound();

  const contact = conversation.contacts as unknown as { name: string | null; wa_id: string };

  const { data: messages } = await supabase
    .from("messages")
    .select("id, direction, body, status, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <Link href="/dashboard/inbox" className="text-muted hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {(contact.name ?? contact.wa_id).charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {contact.name ?? contact.wa_id}
          </p>
          <p className="text-xs text-muted">{contact.wa_id}</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages?.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                m.direction === "out"
                  ? "bg-primary text-white"
                  : "bg-surface-hover text-foreground"
              }`}
            >
              <p>{m.body}</p>
              <p className="mt-1 text-[10px] opacity-70">
                {new Date(m.created_at).toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>

      <MessageComposer conversationId={id} />
    </div>
  );
}
