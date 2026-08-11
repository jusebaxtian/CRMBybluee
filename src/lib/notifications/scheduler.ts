import { createAdminClient } from "@/lib/supabase/admin";

const RETENTION_DAYS = 20;

// Notifications aren't kept forever — anything older than the minimum
// retention window gets deleted outright (notification_reads cascades via
// FK, so read state cleans up automatically with it).
export async function cleanupOldNotifications() {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("notifications").delete().lt("created_at", cutoff);
}
