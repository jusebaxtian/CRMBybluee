import { createAdminClient } from "@/lib/supabase/admin";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp/graph";
import { buildFollowupSystemPrompt } from "@/lib/ai/agent";
import { isContactExcludedFromAutomations } from "@/lib/automations/engine";

const HISTORY_LIMIT = 20;
// WhatsApp's customer-service window: free text is only allowed within 24h
// of the customer's own last message — past that, only an approved template
// can reopen the conversation.
const CUSTOMER_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 25;

// Polled from instrumentation.ts alongside the automation scheduler — finds
// conversations where the AI agent sent (or was the last to send) a message
// and the customer never replied, and either writes a natural follow-up
// (inside the 24h window) or sends the workspace's configured follow-up
// template (outside it). Mirrors the no_reply automations pattern but the
// content is generated per-conversation instead of being a fixed action.
export async function processAiFollowups() {
  const supabase = createAdminClient();

  const { data: agents } = await supabase
    .from("ai_agents")
    .select(
      "workspace_id, provider, api_key, model, agent_name, persona, is_active, followup_enabled, followup_delay_minutes, followup_max_attempts, followup_template_id"
    )
    .eq("is_active", true)
    .eq("followup_enabled", true);

  for (const agent of agents ?? []) {
    try {
      await processWorkspaceFollowups(supabase, agent);
    } catch (err) {
      console.error(`AI followup tick failed for workspace=${agent.workspace_id}:`, err);
    }
  }
}

type AgentRow = {
  workspace_id: string;
  provider: "openai" | "anthropic";
  api_key: string;
  model: string;
  agent_name: string;
  persona: string;
  followup_delay_minutes: number;
  followup_max_attempts: number;
  followup_template_id: string | null;
};

async function processWorkspaceFollowups(
  supabase: ReturnType<typeof createAdminClient>,
  agent: AgentRow
) {
  const dueBefore = new Date(Date.now() - agent.followup_delay_minutes * 60_000).toISOString();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, contact_id, last_message_at, ai_followup_count, followups_enabled")
    .eq("workspace_id", agent.workspace_id)
    .eq("ai_handoff_requested", false)
    .eq("ai_manually_paused", false)
    .eq("followups_enabled", true)
    .eq("last_message_direction", "out")
    .lt("ai_followup_count", agent.followup_max_attempts)
    .lte("last_message_at", dueBefore)
    .limit(BATCH_LIMIT);

  if (!conversations || conversations.length === 0) return;

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", agent.workspace_id)
    .maybeSingle();
  if (!account) return;

  let template: {
    meta_template_name: string;
    language: string;
    body_text: string | null;
    header_format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    header_media_url: string | null;
  } | null = null;
  if (agent.followup_template_id) {
    const { data } = await supabase
      .from("templates")
      .select("meta_template_name, language, body_text, header_format, header_media_url")
      .eq("id", agent.followup_template_id)
      .maybeSingle();
    template = data;
  }

  for (const conversation of conversations) {
    if (await isContactExcludedFromAutomations(supabase, conversation.contact_id)) continue;

    // Claim it first — a slow tick or overlapping run can't double-send the
    // same follow-up, matching the automation scheduler's claim-then-act pattern.
    const { data: claimed } = await supabase
      .from("conversations")
      .update({ ai_followup_count: conversation.ai_followup_count + 1 })
      .eq("id", conversation.id)
      .eq("ai_followup_count", conversation.ai_followup_count)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      await sendFollowup(supabase, agent, conversation.id, conversation.contact_id, account, template);
    } catch (err) {
      console.error(
        `AI followup send failed conversation=${conversation.id} workspace=${agent.workspace_id}:`,
        err
      );
    }
  }
}

async function sendFollowup(
  supabase: ReturnType<typeof createAdminClient>,
  agent: AgentRow,
  conversationId: string,
  contactId: string,
  account: { phone_number_id: string; access_token: string },
  template: {
    meta_template_name: string;
    language: string;
    body_text: string | null;
    header_format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    header_media_url: string | null;
  } | null
) {
  const { data: contact } = await supabase.from("contacts").select("wa_id").eq("id", contactId).single();
  if (!contact) return;

  const { data: lastInbound } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const withinWindow =
    !!lastInbound && Date.now() - new Date(lastInbound.created_at).getTime() < CUSTOMER_WINDOW_MS;

  if (withinWindow) {
    const { data: pastMessages } = await supabase
      .from("messages")
      .select("direction, body, message_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const history: ChatTurn[] = (pastMessages ?? [])
      .reverse()
      .filter((m) => m.body && m.message_type !== "document")
      .map((m) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body as string }));
    if (history.length === 0) return;

    let reply: string;
    try {
      reply = await callAiProvider(
        agent.provider,
        agent.api_key,
        agent.model,
        buildFollowupSystemPrompt(agent.agent_name, agent.persona),
        history
      );
    } catch (err) {
      console.error(`AI followup generation failed for workspace=${agent.workspace_id}:`, err);
      return;
    }
    const text = reply?.trim();
    if (!text) return;

    const result = await sendTextMessage(account.phone_number_id, account.access_token, contact.wa_id, text);
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      message_type: "text",
      body: text,
      wa_message_id: result.messages[0]?.id,
      status: "sent",
      exclude_from_followups: true,
    });
  } else {
    if (!template) return;

    const headerMedia =
      template.header_format && template.header_format !== "TEXT" && template.header_media_url
        ? {
            type: template.header_format.toLowerCase() as "image" | "video" | "document",
            link: template.header_media_url,
          }
        : undefined;

    const result = await sendTemplateMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      template.meta_template_name,
      template.language,
      undefined,
      headerMedia
    );
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      message_type: headerMedia ? headerMedia.type : "template",
      body: template.body_text,
      media_url: headerMedia?.link ?? null,
      wa_message_id: result.messages[0]?.id,
      status: "sent",
      exclude_from_followups: true,
    });
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}
