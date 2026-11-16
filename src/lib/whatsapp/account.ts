import type { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

import { estaPausado } from "@/lib/billing/pausa";

type AnySupabase = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export type SendAccount = {
  id: string;
  phone_number_id: string;
  access_token: string;
};

// A reply/send always goes out through the same number the conversation is
// tied to. Falls back to the workspace's first non-frozen number when the
// conversation predates multi-number support (whatsapp_account_id is null)
// or points at a number that's since been disconnected/frozen — keeps every
// existing conversation sendable instead of hard-failing on old data.
export async function resolveSendAccount(
  supabase: AnySupabase,
  workspaceId: string,
  whatsappAccountId?: string | null
): Promise<SendAccount | null> {
  // Red de seguridad: una cuenta con el plan vencido no envia nada (16 nov
  // 2026). Los trabajos de fondo ya la saltan antes, sin gastar sus pendientes.
  const { data: espacio } = await supabase.from("workspaces").select("status, access_disabled").eq("id", workspaceId).maybeSingle();
  if (estaPausado(espacio)) return null;

  if (whatsappAccountId) {
    const { data } = await supabase
      .from("whatsapp_accounts")
      .select("id, phone_number_id, access_token, status")
      .eq("id", whatsappAccountId)
      .maybeSingle();
    if (data && data.status !== "frozen") return data;
  }

  const { data } = await supabase
    .from("whatsapp_accounts")
    .select("id, phone_number_id, access_token, status")
    .eq("workspace_id", workspaceId)
    .neq("status", "frozen")
    .order("connected_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}
