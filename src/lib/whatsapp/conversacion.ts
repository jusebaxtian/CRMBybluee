import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSendAccount } from "@/lib/whatsapp/account";

/**
 * Abre (o reutiliza) la conversacion de un contacto para enviarle algo
 * desde el CRM. Hay una conversacion por contacto POR LINEA (migracion
 * 0108), asi que:
 *
 * - Con linea indicada (masivo con "enviar desde"), se usa/crea el hilo de
 *   esa linea.
 * - Sin linea (mensaje nuevo, reenvio, automatizacion por etiqueta), se
 *   reutiliza el hilo mas reciente del contacto, para responderle por
 *   donde el escribio; si no tiene ninguno, se crea con la linea por
 *   defecto del espacio.
 */
export async function abrirConversacion(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  whatsappAccountId?: string | null
): Promise<{ id: string; whatsapp_account_id: string | null } | null> {
  let accountId = whatsappAccountId ?? null;

  if (!accountId) {
    const { data: existente } = await supabase
      .from("conversations")
      .select("id, whatsapp_account_id")
      .eq("workspace_id", workspaceId)
      .eq("contact_id", contactId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (existente) return existente;

    const cuenta = await resolveSendAccount(supabase, workspaceId, null);
    accountId = cuenta?.id ?? null;
  }

  const { data } = await supabase
    .from("conversations")
    .upsert(
      {
        workspace_id: workspaceId,
        contact_id: contactId,
        ...(accountId ? { whatsapp_account_id: accountId } : {}),
      },
      { onConflict: "workspace_id,contact_id,whatsapp_account_id", ignoreDuplicates: false }
    )
    .select("id, whatsapp_account_id")
    .single();
  return data ?? null;
}
