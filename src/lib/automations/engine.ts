import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTextMessage } from "@/lib/whatsapp/graph";

type Automation = {
  id: string;
  workspace_id: string;
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
    .select("action_type, message_body, tag_id")
    .eq("automation_id", automation.id)
    .order("position");

  try {
    for (const action of actions ?? []) {
      if (action.action_type === "add_tag" && action.tag_id) {
        await supabase
          .from("contact_tags")
          .upsert({ contact_id: contactId, tag_id: action.tag_id });
      }

      if (action.action_type === "send_message" && action.message_body) {
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

        if (contact && account) {
          const conversationId = await getOrCreateConversation(
            supabase,
            automation.workspace_id,
            contactId
          );

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
            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", conversationId);
          }
        }
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
