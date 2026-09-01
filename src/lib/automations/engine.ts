import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendTextMessage,
  sendMediaMessage,
  sendTemplateMessage,
  sendInteractiveButtonsMessage,
  sendInteractiveCtaUrlMessage,
  uploadMedia,
} from "@/lib/whatsapp/graph";
import { maybeTrackPurchaseFromTag } from "@/lib/meta/conversions";
import { substituteContactVariables, buildTemplateSendParams } from "@/lib/whatsapp/variables";
import { resolveSendAccount } from "@/lib/whatsapp/account";

export type Automation = {
  id: string;
  workspace_id: string;
};

export type AutomationAction = {
  position: number;
  action_type: string;
  message_body: string | null;
  tag_id: string | null;
  media_url: string | null;
  media_filename: string | null;
  template_id: string | null;
  quick_reply_id: string | null;
  delay_seconds: number;
  target_agent_id: string | null;
  agent_distribution: { agent_id: string; percent: number }[] | null;
  buttons:
    | ({ type: "QUICK_REPLY"; id: string; title: string } | { type: "URL"; title: string; url: string })[]
    | null;
  templates: {
    meta_template_name: string;
    language: string;
    body_text: string | null;
    header_format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    header_media_url: string | null;
    variable_count?: number;
    buttons?: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  } | null;
};

// Picks one agent from a weighted list (weights don't need to sum to 100 —
// they're treated as relative shares of whatever total they add up to).
function pickWeightedAgent(distribution: { agent_id: string; percent: number }[]): string | null {
  const total = distribution.reduce((sum, d) => sum + Math.max(0, d.percent), 0);
  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const entry of distribution) {
    roll -= Math.max(0, entry.percent);
    if (roll <= 0) return entry.agent_id;
  }
  return distribution[distribution.length - 1].agent_id;
}

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

export async function executeAction(
  supabase: SupabaseClient,
  automation: Automation,
  contactId: string,
  action: AutomationAction,
  depth = 0
) {
  // send_quick_reply recurses back into this function to run the quick
  // reply's own actions — a hard depth cap is just a safety net in case a
  // quick reply is ever made to reference itself (the UI doesn't expose
  // that option, but nothing stops a direct DB edit from creating one).
  if (depth > 3) return;

  if (action.action_type === "send_quick_reply" && action.quick_reply_id) {
    const { data: qrActions } = await supabase
      .from("quick_reply_actions")
      .select(
        "position, action_type, message_body, tag_id, media_url, media_filename, template_id, buttons, templates(meta_template_name, language, body_text, header_format, header_media_url, variable_count, buttons)"
      )
      .eq("quick_reply_id", action.quick_reply_id)
      .order("position");

    for (const qrAction of qrActions ?? []) {
      await executeAction(
        supabase,
        automation,
        contactId,
        {
          ...qrAction,
          quick_reply_id: null,
          delay_seconds: 0,
          target_agent_id: null,
          agent_distribution: null,
          templates: qrAction.templates as unknown as AutomationAction["templates"],
        },
        depth + 1
      );
    }
    return;
  }

  if (action.action_type === "add_tag" && action.tag_id) {
    // Errors here used to be swallowed silently — the caller (runFrom /
    // runActionsForAutomation) would still log "completed" in
    // automation_runs even if this insert failed, with no way to tell an
    // actually-broken tag apart from one that just genuinely didn't apply.
    // Throwing surfaces it as a "failed" run with a real error_message.
    const { error } = await supabase
      .from("contact_tags")
      .upsert({ contact_id: contactId, tag_id: action.tag_id });
    if (error) throw new Error(`No se pudo aplicar la etiqueta: ${error.message}`);
    await maybeTrackPurchaseFromTag(supabase, automation.workspace_id, contactId, action.tag_id);
    return;
  }

  if (action.action_type === "assign_agent" && action.target_agent_id) {
    const conversationId = await getOrCreateConversation(supabase, automation.workspace_id, contactId);
    if (conversationId) {
      await supabase
        .from("conversations")
        .update({ assigned_agent_id: action.target_agent_id })
        .eq("id", conversationId);
    }
    return;
  }

  if (action.action_type === "assign_agent_random" && action.agent_distribution?.length) {
    const chosenAgentId = pickWeightedAgent(action.agent_distribution);
    if (!chosenAgentId) return;
    const conversationId = await getOrCreateConversation(supabase, automation.workspace_id, contactId);
    if (conversationId) {
      await supabase
        .from("conversations")
        .update({ assigned_agent_id: chosenAgentId })
        .eq("id", conversationId);
    }
    return;
  }

  const mediaType = mediaActionType[action.action_type];
  const isMessageAction =
    action.action_type === "send_message" || mediaType || action.action_type === "send_template";
  if (!isMessageAction) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("wa_id, name")
    .eq("id", contactId)
    .single();

  const conversationId = await getOrCreateConversation(supabase, automation.workspace_id, contactId);

  const { data: conversationRow } = conversationId
    ? await supabase.from("conversations").select("whatsapp_account_id").eq("id", conversationId).maybeSingle()
    : { data: null };

  const account = await resolveSendAccount(
    supabase,
    automation.workspace_id,
    conversationRow?.whatsapp_account_id
  );

  if (!contact || !account) return;

  if (action.action_type === "send_message" && action.message_body) {
    const body = substituteContactVariables(action.message_body, contact);
    const urlButton = action.buttons?.find((b) => b.type === "URL");
    const quickReplyButtons = action.buttons?.filter(
      (b): b is { type: "QUICK_REPLY"; id: string; title: string } => b.type === "QUICK_REPLY"
    );

    const result = urlButton
      ? await sendInteractiveCtaUrlMessage(
          account.phone_number_id,
          account.access_token,
          contact.wa_id,
          body,
          urlButton.title,
          urlButton.url
        )
      : quickReplyButtons && quickReplyButtons.length > 0
        ? await sendInteractiveButtonsMessage(
            account.phone_number_id,
            account.access_token,
            contact.wa_id,
            body,
            quickReplyButtons
          )
        : await sendTextMessage(account.phone_number_id, account.access_token, contact.wa_id, body);

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: "text",
        body,
        buttons: urlButton ? [urlButton] : quickReplyButtons && quickReplyButtons.length > 0 ? quickReplyButtons : null,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
        via_automation_id: automation.id,
      });
    }
  }

  if (mediaType && action.media_url) {
    // Sending by { link } makes Meta fetch the file over HTTP itself — any
    // blip on that fetch (confirmed in production for campaigns: a burst of
    // "DNS resolution timed out" failures under load, not a real DNS
    // outage) fails the send outright, and for audio specifically it can
    // even show "delivered" while leaving an unplayable voice note. Upload
    // once and send by { id } instead whenever possible; only fall back to
    // { link } if the upload itself fails.
    let source: { id: string } | { link: string } = { link: action.media_url };
    try {
      const fileRes = await fetch(action.media_url);
      if (!fileRes.ok) throw new Error(`descarga falló (${fileRes.status})`);
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const mimeType = mediaType === "audio" ? "audio/ogg" : fileRes.headers.get("content-type") ?? "application/octet-stream";
      const mediaId = await uploadMedia(
        account.phone_number_id,
        account.access_token,
        buffer,
        mimeType,
        action.media_filename ?? "archivo"
      );
      source = { id: mediaId };
    } catch (err) {
      console.error("media pre-upload failed, falling back to link:", err);
    }

    const result = await sendMediaMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      mediaType,
      source,
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
        via_automation_id: automation.id,
      });
    }
  }

  if (action.action_type === "send_template" && action.template_id && action.templates) {
    const headerFormat = action.templates.header_format;
    const headerMedia =
      headerFormat && headerFormat !== "TEXT" && action.templates.header_media_url
        ? {
            type: headerFormat.toLowerCase() as "image" | "video" | "document",
            link: action.templates.header_media_url,
          }
        : undefined;

    const { bodyParams, buttonUrlParam } = buildTemplateSendParams(action.templates, contact);
    const result = await sendTemplateMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      action.templates.meta_template_name,
      action.templates.language,
      bodyParams,
      headerMedia,
      buttonUrlParam
    );

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: headerMedia ? headerMedia.type : "template",
        body: action.templates.body_text || `[Plantilla: ${action.templates.meta_template_name}]`,
        media_url: headerMedia?.link ?? null,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
        via_automation_id: automation.id,
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
      "position, action_type, message_body, tag_id, media_url, media_filename, template_id, quick_reply_id, delay_seconds, target_agent_id, agent_distribution, buttons, templates(meta_template_name, language, body_text, header_format, header_media_url, variable_count, buttons)"
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

export async function runActionsForAutomation(
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
  // A contact tagged e.g. "Ya compró" (excludes_followups) shouldn't have any
  // more automations fire on them, whether triggered by keyword or by
  // another tag being added — only manual mass campaigns should still reach them.
  if (await isContactExcludedFromAutomations(supabase, contactId)) return;

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

// Shared exclusion check for every automation trigger type (tag_added,
// keyword, and no_reply follow-ups) — a contact tagged "excludes_followups"
// (e.g. "Ya compró", "No interesados") never gets another automation step,
// regardless of what triggers it. Re-checked right before a deferred
// follow-up step fires too, since the tag may have been added mid-wait.
export async function isContactExcludedFromAutomations(
  supabase: SupabaseClient,
  contactId: string
): Promise<boolean> {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("followups_enabled")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (conversation && conversation.followups_enabled === false) return true;

  const { data: contact } = await supabase
    .from("contacts")
    .select("likely_blocked")
    .eq("id", contactId)
    .maybeSingle();
  if (contact?.likely_blocked) return true;

  const { data: tags } = await supabase
    .from("contact_tags")
    .select("tags(excludes_followups)")
    .eq("contact_id", contactId);

  return (tags ?? []).some(
    (t) => (t.tags as unknown as { excludes_followups: boolean } | null)?.excludes_followups
  );
}

// Kept as an alias — the scheduler only deals with no_reply follow-up runs,
// so the old, narrower name still reads correctly there.
export const isContactExcludedFromFollowups = isContactExcludedFromAutomations;

// Returns whether any keyword automation actually matched and ran — the AI
// sales agent skips replying when one did, so the customer doesn't get two
// answers to the same message.
export async function runKeywordAutomations(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  messageBody: string
): Promise<boolean> {
  if (await isContactExcludedFromAutomations(supabase, contactId)) return false;

  const { data: automations } = await supabase
    .from("automations")
    .select("id, workspace_id, trigger_keyword")
    .eq("workspace_id", workspaceId)
    .eq("trigger_type", "keyword")
    .eq("is_active", true);

  const lowerBody = messageBody.toLowerCase();
  // trigger_keyword can hold several keywords separated by commas (e.g.
  // "hola, saludos, buenos días") — matches if the message contains ANY one
  // of them, not just the whole string verbatim.
  const candidates = (automations ?? []).filter((a) => {
    if (!a.trigger_keyword) return false;
    const keywords: string[] = a.trigger_keyword
      .split(",")
      .map((k: string) => k.trim().toLowerCase())
      .filter((k: string) => k.length > 0);
    return keywords.some((k: string) => lowerBody.includes(k));
  });
  if (candidates.length === 0) return false;

  // A keyword flow (e.g. "hola") runs once per contact, ever — otherwise a
  // customer who greets you daily retriggers the whole welcome sequence
  // every single time. Claim each candidate via automation_starts before
  // running it; on conflict (already started) it's skipped.
  const { data: claimed } = await supabase
    .from("automation_starts")
    .upsert(
      candidates.map((a) => ({ automation_id: a.id, contact_id: contactId })),
      { onConflict: "automation_id,contact_id", ignoreDuplicates: true }
    )
    .select("automation_id");
  const claimedIds = new Set((claimed ?? []).map((c) => c.automation_id));

  let matched = false;
  for (const automation of candidates) {
    if (!claimedIds.has(automation.id)) continue;
    matched = true;
    await runActionsForAutomation(supabase, automation, contactId);
  }

  return matched;
}

// Fires on ANY inbound message from the contact, no keyword needed — a
// catch-all "whatever they write" welcome/handoff trigger. Once per
// contact, ever (same automation_starts claim as tag/keyword/button_tap).
export async function runAnyMessageAutomations(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string
): Promise<boolean> {
  if (await isContactExcludedFromAutomations(supabase, contactId)) return false;

  const { data: automations } = await supabase
    .from("automations")
    .select("id, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("trigger_type", "any_message")
    .eq("is_active", true);
  if (!automations || automations.length === 0) return false;

  const { data: claimed } = await supabase
    .from("automation_starts")
    .upsert(
      automations.map((a) => ({ automation_id: a.id, contact_id: contactId })),
      { onConflict: "automation_id,contact_id", ignoreDuplicates: true }
    )
    .select("automation_id");
  const claimedIds = new Set((claimed ?? []).map((c) => c.automation_id));

  let matched = false;
  for (const automation of automations) {
    if (!claimedIds.has(automation.id)) continue;
    matched = true;
    await runActionsForAutomation(supabase, automation, contactId);
  }
  return matched;
}

// Fires on the contact's FIRST message of the current calendar day — unlike
// every other trigger this repeats daily instead of once-per-contact-ever,
// so it claims via a separate, date-scoped table (automation_daily_starts).
export async function runFirstMessageOfDayAutomations(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string
): Promise<boolean> {
  if (await isContactExcludedFromAutomations(supabase, contactId)) return false;

  const { data: automations } = await supabase
    .from("automations")
    .select("id, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("trigger_type", "first_message_of_day")
    .eq("is_active", true);
  if (!automations || automations.length === 0) return false;

  const today = new Date().toISOString().slice(0, 10);
  const { data: claimed } = await supabase
    .from("automation_daily_starts")
    .upsert(
      automations.map((a) => ({ automation_id: a.id, contact_id: contactId, started_on: today })),
      { onConflict: "automation_id,contact_id,started_on", ignoreDuplicates: true }
    )
    .select("automation_id");
  const claimedIds = new Set((claimed ?? []).map((c) => c.automation_id));

  let matched = false;
  for (const automation of automations) {
    if (!claimedIds.has(automation.id)) continue;
    matched = true;
    await runActionsForAutomation(supabase, automation, contactId);
  }
  return matched;
}

// Fires when a contact taps a button (template Quick Reply or a session
// interactive button) whose id/payload exactly matches an automation's
// configured trigger_keyword — exact match, unlike runKeywordAutomations'
// substring match, since a button payload is an identifier, not free text a
// customer typed. Same once-per-contact claim via automation_starts.
export async function runButtonTapAutomations(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  buttonPayload: string
): Promise<boolean> {
  if (await isContactExcludedFromAutomations(supabase, contactId)) return false;

  const { data: automations } = await supabase
    .from("automations")
    .select("id, workspace_id, trigger_keyword")
    .eq("workspace_id", workspaceId)
    .eq("trigger_type", "button_tap")
    .eq("is_active", true);

  const candidates = (automations ?? []).filter((a) => a.trigger_keyword === buttonPayload);
  if (candidates.length === 0) return false;

  const { data: claimed } = await supabase
    .from("automation_starts")
    .upsert(
      candidates.map((a) => ({ automation_id: a.id, contact_id: contactId })),
      { onConflict: "automation_id,contact_id", ignoreDuplicates: true }
    )
    .select("automation_id");
  const claimedIds = new Set((claimed ?? []).map((c) => c.automation_id));

  let matched = false;
  for (const automation of candidates) {
    if (!claimedIds.has(automation.id)) continue;
    matched = true;
    await runActionsForAutomation(supabase, automation, contactId);
  }

  return matched;
}
