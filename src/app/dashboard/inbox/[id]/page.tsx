import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContactTagPicker } from "@/components/contact-tag-picker";
import { NotesEditor } from "@/components/notes-editor";
import { ChatPane } from "@/components/chat-pane";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ConversationAssignmentControl } from "@/components/conversation-assignment-control";
import { ConversationDetailsSheet } from "@/components/conversation-details-sheet";
import { ConversationWindowStatus } from "@/components/conversation-window-status";
import { ConversationFollowupsToggle } from "@/components/conversation-followups-toggle";
import { ContactBlockedNotice } from "@/components/contact-blocked-notice";
import { AiHandoffNotice } from "@/components/ai-handoff-notice";
import { ConversationAiToggle } from "@/components/conversation-ai-toggle";
import { getWorkspaceId } from "@/lib/workspace";
import { listWorkspaceAgents } from "@/lib/agents";
import { isPhoneNumber } from "@/lib/whatsapp/identity";

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
    .select(
      "id, contact_id, last_read_at, assigned_agent_id, ad_source_id, ad_headline, ad_body, followups_enabled, ai_handoff_requested, ai_manually_paused, contacts(name, wa_id, notes, likely_blocked, contact_tags(tag_id, tags(excludes_followups)))"
    )
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();

  if (!conversation) notFound();

  const contact = conversation.contacts as unknown as {
    name: string | null;
    wa_id: string;
    notes: string | null;
    likely_blocked: boolean;
    contact_tags: { tag_id: string; tags: { excludes_followups: boolean } | null }[];
  };
  const assignedTagIds = contact.contact_tags.map((ct) => ct.tag_id);
  const excludedFromFollowupsByTag = contact.contact_tags.some((ct) => ct.tags?.excludes_followups);

  const { data: messages } = await supabase
    .from("messages")
    .select("id, direction, body, status, message_type, media_url, media_mime_type, error_detail, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  // Only write when there's something new to mark read — an unconditional
  // update on every render would re-trigger the conversations-table realtime
  // subscription that refreshes this same page, looping forever.
  const lastMessage = messages?.[messages.length - 1];
  const hasUnread =
    !!lastMessage &&
    (!conversation.last_read_at || new Date(lastMessage.created_at) > new Date(conversation.last_read_at));
  if (hasUnread) {
    await supabase
      .from("conversations")
      .update({ last_read_at: new Date().toISOString() })
      .eq("id", id);
  }

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

  const agents = await listWorkspaceAgents(supabase, workspaceId);

  const { data: aiAgent } = workspaceId
    ? await supabase
        .from("ai_agents")
        .select("is_active")
        .eq("workspace_id", workspaceId)
        .maybeSingle()
    : { data: null };
  const hasActiveAiAgent = !!aiAgent?.is_active;

  // All active automations, not just the ones triggered by this contact's
  // tags — the chat's floating menu lets an agent fire any flow manually,
  // same idea as quick replies but reusing automation flows.
  const { data: allAutomations } = await supabase
    .from("automations")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .eq("is_active", true)
    .order("name");

  const { data: quickReplies } = await supabase
    .from("quick_replies")
    .select("id, name")
    .eq("workspace_id", workspaceId ?? "")
    .eq("is_active", true)
    .order("name");

  const { data: approvedTemplates } = await supabase
    .from("templates")
    .select("id, meta_template_name, language, body_text")
    .eq("workspace_id", workspaceId ?? "")
    .eq("status", "APPROVED")
    .order("meta_template_name");

  const lastInboundAt =
    (messages ?? [])
      .filter((m) => m.direction === "in")
      .reduce<string | null>(
        (latest, m) => (!latest || m.created_at > latest ? m.created_at : latest),
        null
      );

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
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {isPhoneNumber(contact.wa_id) ? contact.wa_id : "Usuario"}
              {contact.name && <span className="text-muted"> · {contact.name}</span>}
            </p>
            <ConversationWindowStatus lastInboundAt={lastInboundAt} />
          </div>
          <ConversationDetailsSheet
            contactName={contact.name}
            contactWaId={contact.wa_id}
            conversationId={conversation.id}
            contactId={conversation.contact_id}
            agents={agents}
            assignedAgentId={conversation.assigned_agent_id}
            allTags={allTags ?? []}
            assignedTagIds={assignedTagIds}
            notes={contact.notes}
            automations={automations ?? []}
            likelyBlocked={contact.likely_blocked}
            aiHandoffRequested={conversation.ai_handoff_requested}
            hasActiveAiAgent={hasActiveAiAgent}
            aiManuallyPaused={conversation.ai_manually_paused}
            followupsEnabled={conversation.followups_enabled}
            excludedFromFollowupsByTag={excludedFromFollowupsByTag}
            adSourceId={conversation.ad_source_id}
            adHeadline={conversation.ad_headline}
            adBody={conversation.ad_body}
          />
        </div>

        <ChatPane
          conversationId={id}
          contactId={conversation.contact_id}
          messages={messages ?? []}
          quickReplies={quickReplies ?? []}
          automations={allAutomations ?? []}
          approvedTemplates={approvedTemplates ?? []}
        />
      </div>

      <aside className="hidden w-72 shrink-0 overflow-y-auto bg-surface p-5 lg:block">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-semibold text-primary">
            {(contact.name ?? contact.wa_id).charAt(0).toUpperCase()}
          </div>
          <p className="mt-3 text-base font-semibold text-foreground">
            {contact.name ?? (isPhoneNumber(contact.wa_id) ? contact.wa_id : "Usuario")}
          </p>
          <p className="text-sm text-muted">
            {isPhoneNumber(contact.wa_id) ? contact.wa_id : "Usuario (sin número)"}
          </p>
        </div>

        {contact.likely_blocked && <ContactBlockedNotice contactId={conversation.contact_id} />}
        {(conversation.ai_handoff_requested || conversation.ai_manually_paused) && (
          <AiHandoffNotice
            conversationId={conversation.id}
            aiRequested={conversation.ai_handoff_requested}
          />
        )}

        {conversation.ad_source_id && (
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Megaphone size={13} />
              Vino de un anuncio de Meta Ads
            </p>
            {conversation.ad_headline && (
              <p className="mt-1 text-xs text-foreground">{conversation.ad_headline}</p>
            )}
            {conversation.ad_body && (
              <p className="mt-0.5 text-xs text-muted">{conversation.ad_body}</p>
            )}
          </div>
        )}

        {agents.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Asignado a
            </p>
            <ConversationAssignmentControl
              conversationId={conversation.id}
              agents={agents}
              assignedAgentId={conversation.assigned_agent_id}
            />
          </div>
        )}

        {hasActiveAiAgent && (
          <div className="mt-6">
            <ConversationAiToggle
              conversationId={conversation.id}
              manuallyPaused={conversation.ai_manually_paused}
            />
          </div>
        )}

        <div className="mt-6">
          <ConversationFollowupsToggle
            conversationId={conversation.id}
            enabled={conversation.followups_enabled}
            excludedByTag={excludedFromFollowupsByTag}
          />
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
