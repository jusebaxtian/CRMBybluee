import { createAdminClient } from "@/lib/supabase/admin";

const RETENTION_DAYS = 20;

// Notifications aren't kept forever — anything older than the minimum
// retention window gets deleted outright (notification_reads cascades via
// FK, so read state cleans up automatically with it).
//
// Las automaticas (sin created_by, ej. "X creo su cuenta") son avisos de
// paso: nacen con ends_at a pocos dias y se borran apenas vencen, para no
// acumular filas que nadie va a volver a mirar.
export async function cleanupOldNotifications() {
  const supabase = createAdminClient();
  const ahora = new Date();
  const cutoff = new Date(ahora.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("notifications").delete().lt("created_at", cutoff);
  await supabase.from("notifications").delete().is("created_by", null).lt("ends_at", ahora.toISOString());
}
