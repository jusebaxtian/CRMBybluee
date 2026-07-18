import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MessageComposer } from "@/components/message-composer";
import { ContactTagPicker } from "@/components/contact-tag-picker";
import { NotesEditor } from "@/components/notes-editor";
import { MessagesScrollArea } from "@/components/messages-scroll-area";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { getWorkspaceId } from "@/lib/workspace";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, contact_id, contacts(name, wa_id, notes, contact_tags(tag_id))")
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();

  if (!conversation) notFound();

  const contact = conversation.contacts as unknown as {
    name: string | null;
    wa_id: string;
    notes: string | null;
    contact_tags: { tag_id: string }[];
  };
  const assignedTagIds = contact.contact_tags.map((ct) => ct.tag_id);

  const { data: messages } = await supabase
    .from("messages")
    .select("id, direction, body, status, message_type, media_url, media_mime_type, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const { data: allTags } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("workspace_id", workspaceId ?? "")
    .order("name");

  const { data: automations } = assignedTagIds.length > 0
    ? await supabase
        .from("automations")
        .select("id, name, is_active")
        .eq("workspace_id", workspaceId ?? "")
        .eq("trigger_type", "tag_added")
        .in("trigger_tag_id", assignedTagIds)
    : { data: [] };

  return (
    <div className="flex h-full w-full min-w-0 flex-1">
      <RealtimeRefresh
        table="messages"
        filter={`conversation_id=eq.${id}`}
        channelName={`messages-${id}`}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
        <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5 sm:py-4">
          <Link
            href="/dashboard/inbox"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground lg:hidden"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {(contact.name ?? contact.wa_id).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {contact.name ?? contact.wa_id}
            </p>
            <p className="text-xs text-muted">Cliente</p>
          </div>
        </div>

        <MessagesScrollArea messages={messages ?? []} />

        <MessageComposer conversationId={id} />
      </div>

      <aside className="hidden w-72 shrink-0 overflow-y-auto bg-surface p-5 lg:block">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
            {(contact.name ?? contact.wa_id).charAt(0).toUpperCase()}
          </div>
          <p className="mt-3 text-base font-semibold text-foreground">
            {contact.name ?? contact.wa_id}
          </p>
          <p className="text-sm text-muted">{contact.wa_id}</p>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Etiquetas
          </p>
          <ContactTagPicker
            contactId={conversation.contact_id}
            allTags={allTags ?? []}
            assignedTagIds={assignedTagIds}
          />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Notas
          </p>
          <NotesEditor contactId={conversation.contact_id} initialNotes={contact.notes} />
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Automatizaciones activas
          </p>
          {automations && automations.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {automations.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                >
                  <Zap size={12} className={a.is_active ? "text-success" : "text-muted"} />
                  {a.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Ninguna automatización activa para este contacto.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
