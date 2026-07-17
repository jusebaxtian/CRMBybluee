import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-types";
import { runKeywordAutomations } from "@/lib/automations/engine";

export async function ingestWhatsAppWebhook(payload: WhatsAppWebhookPayload) {
  const supabase = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const { value } = change;
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: account } = await supabase
        .from("whatsapp_accounts")
        .select("workspace_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();

      if (!account) continue;
      const workspaceId = account.workspace_id as string;

      for (const message of value.messages ?? []) {
        const profileName = value.contacts?.find((c) => c.wa_id === message.from)
          ?.profile?.name;

        const { data: contact } = await supabase
          .from("contacts")
          .upsert(
            { workspace_id: workspaceId, wa_id: message.from, name: profileName },
            { onConflict: "workspace_id,wa_id", ignoreDuplicates: false }
          )
          .select("id")
          .single();

        if (!contact) continue;

        const { data: conversation } = await supabase
          .from("conversations")
          .upsert(
            {
              workspace_id: workspaceId,
              contact_id: contact.id,
              last_message_at: new Date(Number(message.timestamp) * 1000).toISOString(),
              status: "open",
            },
            { onConflict: "workspace_id,contact_id" }
          )
          .select("id")
          .single();

        if (!conversation) continue;

        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          direction: "in",
          message_type: message.type,
          body: message.text?.body ?? `[${message.type}]`,
          wa_message_id: message.id,
          status: "delivered",
          created_at: new Date(Number(message.timestamp) * 1000).toISOString(),
        });

        if (message.text?.body) {
          await runKeywordAutomations(supabase, workspaceId, contact.id, message.text.body);
        }
      }

      for (const status of value.statuses ?? []) {
        await supabase
          .from("messages")
          .update({ status: status.status })
          .eq("wa_message_id", status.id);
      }
    }
  }
}
