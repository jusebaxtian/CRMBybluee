import type { SupabaseClient } from "@supabase/supabase-js";

const GRAPH_VERSION = "v21.0";

// Reports a Purchase event back to Meta's Conversions API for the
// Click-to-WhatsApp ad that originally brought this contact in — the
// ctwa_clid is what lets Meta's optimizer credit that specific ad click with
// a real sale, instead of only seeing "message received."
// Silently no-ops when the workspace hasn't configured a dataset, or when
// this particular contact never came from a WhatsApp ad (most organic
// contacts won't have a ctwa_clid, that's expected, not an error).
export async function sendPurchaseConversionEvent(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string
) {
  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("access_token, ctwa_dataset_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!account?.ctwa_dataset_id) return;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("ctwa_clid")
    .eq("workspace_id", workspaceId)
    .eq("contact_id", contactId)
    .not("ctwa_clid", "is", null)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation?.ctwa_clid) return;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${account.ctwa_dataset_id}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: [
            {
              event_name: "Purchase",
              event_time: Math.floor(Date.now() / 1000),
              action_source: "business_messaging",
              messaging_channel: "whatsapp",
              ctwa_clid: conversation.ctwa_clid,
            },
          ],
        }),
      }
    );
    const body = await res.json();
    if (!res.ok) {
      console.error(
        `CTWA purchase conversion event failed for workspace=${workspaceId} contact=${contactId}:`,
        body
      );
    }
  } catch (err) {
    console.error(
      `CTWA purchase conversion event request failed for workspace=${workspaceId} contact=${contactId}:`,
      err
    );
  }
}

// Looks up whether a tag is configured to report a purchase, and fires the
// event if so — call this right after a tag assignment succeeds.
export async function maybeTrackPurchaseFromTag(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  tagId: string
) {
  const { data: tag } = await supabase
    .from("tags")
    .select("marks_purchase")
    .eq("id", tagId)
    .maybeSingle();
  if (!tag?.marks_purchase) return;

  await sendPurchaseConversionEvent(supabase, workspaceId, contactId);
}
