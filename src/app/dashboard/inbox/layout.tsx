import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { ConversationListPanel } from "@/components/conversation-list-panel";

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

  const conversations = (conversationsRaw ?? []).map((c) => ({
    id: c.id,
    last_message_at: c.last_message_at,
    contact: c.contacts as unknown as { name: string | null; wa_id: string },
  }));

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, wa_id")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  return (
    <div className="-m-8 flex h-[calc(100vh-5.25rem)]">
      <ConversationListPanel conversations={conversations} contacts={contacts ?? []} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
