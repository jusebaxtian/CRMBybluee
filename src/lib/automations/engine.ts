import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTextMessage, sendMediaMessage, sendTemplateMessage } from "@/lib/whatsapp/graph";

type Automation = {
  id: string;
  workspace_id: string;
};

type AutomationAction = {
  position: number;
  action_type: string;
  message_body: string | null;
  tag_id: string | null;
  media_url: string | null;
  media_filename: string | null;
  template_id: string | null;
  delay_seconds: number;
  templates: { meta_template_name: string; language: string } | null;
};

const mediaActionType: Record<string, "image" | "video" | "audio" | "document"> = {
  send_image: "image",
  send_video: "video",
  send_audio: "audio",
  send_document: "document",
};

async function getOrCreateConversation(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("conversations")
    .upsert(
      { workspace_id: workspaceId, contact_id: contactId },
      { onConflict: "workspace_id,contact_id" }
    )
    .select("id")
    .single();
  return data?.id ?? null;
}

async function executeAction(
  supabase: SupabaseClient,
  automation: Automation,
  contactId: string,
  action: AutomationAction
) {
  if (action.action_type === "add_tag" && action.tag_id) {
    await supabase.from("contact_tags").upsert({ contact_id: contactId, tag_id: action.tag_id });
    return;
  }

  const mediaType = mediaActionType[action.action_type];
  const isMessageAction =
    action.action_type === "send_message" || mediaType || action.action_type === "send_template";
  if (!isMessageAction) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("wa_id")
    .eq("id", contactId)
    .single();

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", automation.workspace_id)
    .maybeSingle();

  if (!contact || !account) return;

  const conversationId = await getOrCreateConversation(supabase, automation.workspace_id, contactId);

  if (action.action_type === "send_message" && action.message_body) {
    const result = await sendTextMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      action.message_body
    );

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: "text",
        body: action.message_body,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
      });
    }
  }

  if (mediaType && action.media_url) {
    const result = await sendMediaMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      mediaType,
      action.media_url,
      action.media_filename ?? undefined,
      mediaType !== "audio" ? action.message_body ?? undefined : undefined
    );

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: mediaType,
        body: mediaType === "document" ? action.media_filename : action.message_body,
        media_url: action.media_url,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
      });
    }
  }

  if (action.action_type === "send_template" && action.template_id && action.templates) {
    const result = await sendTemplateMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      action.templates.meta_template_name,
      action.templates.language
    );

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: "template",
        body: `[Plantilla: ${action.templates.meta_template_name}]`,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
      });
    }
  }

  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }
}

async function fetchActions(
  supabase: SupabaseClient,
  automationId: string
): Promise<AutomationAction[]> {
  const { data } = await supabase
    .from("automation_actions")
    .select(
      "position, action_type, message_body, tag_id, media_url, media_filename, template_id, delay_seconds, templates(meta_template_name, language)"
    )
    .eq("automation_id", automationId)
    .order("position");
  return (data ?? []) as unknown as AutomationAction[];
}

// Runs actions in order starting at `fromIndex`. As soon as it hits an
// action with a delay, it schedules a pending run for that same action and
// stops — the in-process poller (see scheduler.ts) picks it back up once due,
// so a webhook/tag-assignment request never blocks waiting on a real sleep.
async function runFrom(
  supabase: SupabaseClient,
  automation: Automation,
  contactId: string,
  actions: AutomationAction[],
  fromIndex: number
) {
  for (let i = fromIndex; i < actions.length; i++) {
    const action = actions[i];

    if (action.delay_seconds > 0) {
      const runAt = new Date(Date.now() + action.delay_seconds * 1000).toISOString();
      await supabase.from("automation_pending_runs").insert({
        workspace_id: automation.workspace_id,
        automation_id: automation.id,
        contact_id: contactId,
        next_position: action.position,
        run_at: runAt,
      });
      return;
    }

    await executeAction(supabase, automation, contactId, action);
  }
}

async function runActionsForAutomation(
  supabase: SupabaseClient,
  automation: Automation,
  contactId: string
) {
  try {
    const actions = await fetchActions(supabase, automation.id);
    await runFrom(supabase, automation, contactId, actions, 0);

    await supabase.from("automation_runs").insert({
      automation_id: automation.id,
      contact_id: contactId,
      status: "completed",
    });
  } catch (err) {
    await supabase.from("automation_runs").insert({
      automation_id: automation.id,
      contact_id: contactId,
      status: "failed",
      error_message: err instanceof Error ? err.message : "Error desconocido.",
    });
  }
}

// Called by the scheduler poller to resume a delayed action once it's due.
export async function resumeAutomationRun(
  supabase: SupabaseClient,
  automation: Automation,
  contactId: string,
  fromPosition: number
) {
  try {
    const actions = await fetchActions(supabase, automation.id);
    const startIndex = actions.findIndex((a) => a.position === fromPosition);
    if (startIndex === -1) return;

    // The due action's own delay has already elapsed — run it now, then
    // continue in order (delay_seconds is "wait before this action").
    await executeAction(supabase, automation, contactId, actions[startIndex]);
    await runFrom(supabase, automation, contactId, actions, startIndex + 1);

    await supabase.from("automation_runs").insert({
      automation_id: automation.id,
      contact_id: contactId,
      status: "completed",
    });
  } catch (err) {
    await supabase.from("automation_runs").insert({
      automation_id: automation.id,
      contact_id: contactId,
      status: "failed",
      error_message: err instanceof Error ? err.message : "Error desconocido.",
    });
  }
}

export async function runTagAddedAutomations(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  tagId: string
) {
  const { data: automations } = await supabase
    .from("automations")
    .select("id, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("trigger_type", "tag_added")
    .eq("trigger_tag_id", tagId)
    .eq("is_active", true);

  for (const automation of automations ?? []) {
    await runActionsForAutomation(supabase, automation, contactId);
  }
}

export async function runKeywordAutomations(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  messageBody: string
) {
  const { data: automations } = await supabase
    .from("automations")
    .select("id, workspace_id, trigger_keyword")
    .eq("workspace_id", workspaceId)
    .eq("trigger_type", "keyword")
    .eq("is_active", true);

  const lowerBody = messageBody.toLowerCase();

  for (const automation of automations ?? []) {
    if (
      automation.trigger_keyword &&
      lowerBody.includes(automation.trigger_keyword.toLowerCase())
    ) {
      await runActionsForAutomation(supabase, automation, contactId);
    }
  }
}
