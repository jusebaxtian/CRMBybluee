import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTextMessage, sendMediaMessage, sendTemplateMessage } from "@/lib/whatsapp/graph";

type Automation = {
  id: string;
  workspace_id: string;
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

async function runActionsForAutomation(
  supabase: SupabaseClient,
  automation: Automation,
  contactId: string
) {
  const { data: actions } = await supabase
    .from("automation_actions")
    .select(
      "action_type, message_body, tag_id, media_url, media_filename, template_id, templates(meta_template_name, language)"
    )
    .eq("automation_id", automation.id)
    .order("position");

  try {
    for (const action of actions ?? []) {
      if (action.action_type === "add_tag" && action.tag_id) {
        await supabase
          .from("contact_tags")
          .upsert({ contact_id: contactId, tag_id: action.tag_id });
        continue;
      }

      const mediaType = mediaActionType[action.action_type];
      const isMessageAction =
        action.action_type === "send_message" || mediaType || action.action_type === "send_template";
      if (!isMessageAction) continue;

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

      if (!contact || !account) continue;

      const conversationId = await getOrCreateConversation(
        supabase,
        automation.workspace_id,
        contactId
      );

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
          action.media_filename ?? undefined
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

      if (action.action_type === "send_template" && action.template_id) {
        const template = action.templates as unknown as
          | { meta_template_name: string; language: string }
          | null;
        if (template) {
          const result = await sendTemplateMessage(
            account.phone_number_id,
            account.access_token,
            contact.wa_id,
            template.meta_template_name,
            template.language
          );

          if (conversationId) {
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              direction: "out",
              message_type: "template",
              body: `[Plantilla: ${template.meta_template_name}]`,
              wa_message_id: result.messages[0]?.id,
              status: "sent",
            });
          }
        }
      }

      if (conversationId) {
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
    }

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
