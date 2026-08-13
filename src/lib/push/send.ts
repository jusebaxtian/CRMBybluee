import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export async function sendPushToUsers(
  supabase: ReturnType<typeof createAdminClient>,
  userIds: string[],
  payload: { title: string; body: string; url?: string; conversationId?: string }
) {
  if (!userIds.length) return;
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
  ensureConfigured();

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .in("user_id", userIds);

  if (!subscriptions?.length) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // Expired/invalid subscription — clean it up so future sends don't retry it.
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}

// Notifies the assigned agent if the conversation has one, otherwise every
// owner/admin of the workspace — mirrors who can currently see the chat.
export async function notifyNewMessage(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  conversationId: string,
  assignedAgentId: string | null,
  contactName: string | null,
  contactPhone: string,
  messagePreview: string
) {
  let recipientIds: string[] = [];

  if (assignedAgentId) {
    recipientIds = [assignedAgentId];
  } else {
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .in("role", ["owner", "admin"]);
    recipientIds = (members ?? []).map((m) => m.user_id as string);
  }

  // Title shows both the saved name and the raw number (e.g. "María González — 573215118640")
  // so the notification is identifiable even before opening the app, same as
  // the inbox list's name-then-phone layout.
  const title = contactName ? `${contactName} — ${contactPhone}` : contactPhone;

  await sendPushToUsers(supabase, recipientIds, {
    title,
    body: messagePreview.slice(0, 120),
    url: `/dashboard/inbox/${conversationId}`,
    conversationId,
  });
}
