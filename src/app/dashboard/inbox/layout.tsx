import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { ConversationListPanel } from "@/components/inbox/conversation-list-panel";
import { InboxShell } from "@/components/inbox/inbox-shell";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { listWorkspaceAgents } from "@/lib/agents";
import { loadInboxPage } from "@/lib/inbox/load";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "inbox");

  // Una sola pagina. Antes se pedia sin limite y PostgREST cortaba en 1.000
  // por su cuenta: el espacio de 9.991 conversaciones mostraba 1.000 y nada
  // lo indicaba. El resto de paginas las trae cargarMasConversaciones.
  const { conversations, hayMas } = await loadInboxPage(supabase, workspaceId ?? "");

  // La insignia de no leidos cuenta sobre todo el espacio, no sobre la pagina.
  const { data: sinLeer } = await supabase.rpc("inbox_unread_count", {
    p_workspace_id: workspaceId ?? "",
  });

  const { data: channels } = workspaceId
    ? await supabase
        .from("whatsapp_accounts")
        .select("id, label, display_phone_number")
        .eq("workspace_id", workspaceId)
        .order("connected_at")
    : { data: [] };

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
            hayMas={hayMas}
            unreadConversationsCount={Number(sinLeer ?? 0)}
            contacts={contacts ?? []}
            allTags={workspaceTags ?? []}
            agents={agents}
            channels={channels ?? []}
          />
        }
      >
        {children}
      </InboxShell>
    </div>
  );
}
