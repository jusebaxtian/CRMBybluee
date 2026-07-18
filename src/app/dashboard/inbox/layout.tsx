import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { ConversationListPanel } from "@/components/conversation-list-panel";
import { InboxShell } from "@/components/inbox-shell";
import { RealtimeRefresh } from "@/components/realtime-refresh";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "inbox");

  const { data: conversationsRaw } = await supabase
    .from("conversations")
    .select(
      "id, last_message_at, last_read_at, contacts(name, wa_id, contact_tags(tags(id, name, color)))"
    )
    .eq("workspace_id", workspaceId ?? "")
    .order("last_message_at", { ascending: false });

  const conversationIds = (conversationsRaw ?? []).map((c) => c.id);

  const { data: recentMessages } = conversationIds.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, message_type, direction, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const lastReadAtByConversation = new Map(
    (conversationsRaw ?? []).map((c) => [c.id, c.last_read_at as string | null])
  );

  const lastMessageByConversation = new Map<
    string,
    { body: string | null; message_type: string; direction: string }
  >();
  const unreadCountByConversation = new Map<string, number>();

  for (const m of recentMessages ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) {
      lastMessageByConversation.set(m.conversation_id, {
        body: m.body,
        message_type: m.message_type,
        direction: m.direction,
      });
    }
    if (m.direction === "in") {
      const lastRead = lastReadAtByConversation.get(m.conversation_id);
      if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
        unreadCountByConversation.set(
          m.conversation_id,
          (unreadCountByConversation.get(m.conversation_id) ?? 0) + 1
        );
      }
    }
  }

  const mediaLabel: Record<string, string> = {
    image: "📷 Foto",
    video: "🎥 Video",
    audio: "🎤 Nota de voz",
    document: "📄 Documento",
  };

  const conversations = (conversationsRaw ?? []).map((c) => {
    const last = lastMessageByConversation.get(c.id);
    const lastMessagePreview = last
      ? last.body ?? mediaLabel[last.message_type] ?? "Mensaje"
      : null;
    const contactRaw = c.contacts as unknown as {
      name: string | null;
      wa_id: string;
      contact_tags: { tags: { id: string; name: string; color: string } | null }[];
    };

    return {
      id: c.id,
      last_message_at: c.last_message_at,
      lastMessagePreview,
      answered: last ? last.direction === "out" : true,
      unreadCount: unreadCountByConversation.get(c.id) ?? 0,
      contact: { name: contactRaw.name, wa_id: contactRaw.wa_id },
      tags: contactRaw.contact_tags.map((ct) => ct.tags).filter((t) => t !== null) as {
        id: string;
        name: string;
        color: string;
      }[],
    };
  });

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, wa_id")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  return (
    <div className="-m-8 h-[calc(100vh-5.25rem)]">
      {workspaceId && (
        <RealtimeRefresh
          table="conversations"
          filter={`workspace_id=eq.${workspaceId}`}
          channelName={`conversations-${workspaceId}`}
        />
      )}
      <InboxShell list={<ConversationListPanel conversations={conversations} contacts={contacts ?? []} />}>
        {children}
      </InboxShell>
    </div>
  );
}
