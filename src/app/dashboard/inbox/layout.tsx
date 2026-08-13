import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { ConversationListPanel } from "@/components/conversation-list-panel";
import { InboxShell } from "@/components/inbox-shell";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { listWorkspaceAgents } from "@/lib/agents";

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
      "id, last_message_at, last_read_at, assigned_agent_id, ad_source_id, ad_headline, ai_handoff_requested, ai_manually_paused, contacts(name, wa_id, likely_blocked, contact_tags(tags(id, name, color)))"
    )
    .eq("workspace_id", workspaceId ?? "")
    .order("last_message_at", { ascending: false });

  // Per-conversation summary (last message, last inbound time, unread
  // count) computed in the DB via lateral joins — scales with conversation
  // count instead of total message count. The previous approach fetched
  // recent messages globally ordered and grouped them in JS, which silently
  // dropped conversations past PostgREST's 1000-row default cap once a
  // workspace's total message volume grew past it (showed "Sin mensajes"
  // for conversations that actually had messages, just not recent enough
  // relative to the rest of the workspace).
  type ConversationSummaryRow = {
    conversation_id: string;
    last_body: string | null;
    last_message_type: string | null;
    last_direction: string | null;
    last_inbound_at: string | null;
    unread_count: number;
  };

  const { data: summaries } = workspaceId
    ? await supabase.rpc("inbox_conversation_summaries", { p_workspace_id: workspaceId })
    : { data: [] as ConversationSummaryRow[] };

  const summaryByConversation = new Map(
    ((summaries ?? []) as ConversationSummaryRow[]).map((s) => [
      s.conversation_id,
      {
        body: s.last_body as string | null,
        message_type: s.last_message_type as string | null,
        direction: s.last_direction as string | null,
        lastInboundAt: s.last_inbound_at as string | null,
        unreadCount: Number(s.unread_count),
      },
    ])
  );

  const mediaLabel: Record<string, string> = {
    image: "📷 Foto",
    video: "🎥 Video",
    audio: "🎤 Nota de voz",
    document: "📄 Documento",
  };

  const conversations = (conversationsRaw ?? []).map((c) => {
    const summary = summaryByConversation.get(c.id);
    const lastMessagePreview = summary
      ? summary.body ?? mediaLabel[summary.message_type ?? ""] ?? "Mensaje"
      : null;
    const contactRaw = c.contacts as unknown as {
      name: string | null;
      wa_id: string;
      likely_blocked: boolean;
      contact_tags: { tags: { id: string; name: string; color: string } | null }[];
    };

    return {
      id: c.id,
      last_message_at: c.last_message_at,
      lastMessagePreview,
      answered: summary ? summary.direction === "out" : true,
      unreadCount: summary?.unreadCount ?? 0,
      assignedAgentId: c.assigned_agent_id as string | null,
      lastInboundAt: summary?.lastInboundAt ?? null,
      fromAds: !!c.ad_source_id,
      adHeadline: c.ad_headline as string | null,
      likelyBlocked: contactRaw.likely_blocked,
      needsHuman: (c.ai_handoff_requested || c.ai_manually_paused) as boolean,
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

  const { data: workspaceTags } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const agents = await listWorkspaceAgents(supabase, workspaceId);

  return (
    <div className="-m-4 sm:-m-5">
      {workspaceId && (
        <RealtimeRefresh
          table="conversations"
          filter={`workspace_id=eq.${workspaceId}`}
          channelName={`conversations-${workspaceId}`}
        />
      )}
      <InboxShell
        list={
          <ConversationListPanel
            conversations={conversations}
            contacts={contacts ?? []}
            allTags={workspaceTags ?? []}
            agents={agents}
          />
        }
      >
        {children}
      </InboxShell>
    </div>
  );
}
