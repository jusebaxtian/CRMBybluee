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
    .select("id, last_message_at, contacts(name, wa_id)")
    .eq("workspace_id", workspaceId ?? "")
    .order("last_message_at", { ascending: false });

  const conversationIds = (conversationsRaw ?? []).map((c) => c.id);

  const { data: recentMessages } = conversationIds.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, message_type")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const lastMessageByConversation = new Map<string, { body: string | null; message_type: string }>();
  for (const m of recentMessages ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) {
      lastMessageByConversation.set(m.conversation_id, { body: m.body, message_type: m.message_type });
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

    return {
      id: c.id,
      last_message_at: c.last_message_at,
      lastMessagePreview,
      contact: c.contacts as unknown as { name: string | null; wa_id: string },
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
