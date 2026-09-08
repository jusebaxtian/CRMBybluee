"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { MAX_PINNED_CONVERSATIONS } from "@/lib/inbox/pins";

/**
 * Fija o quita una conversación de la parte de arriba de la bandeja.
 *
 * El fijado es del espacio de trabajo, no de quien lo pulsa: si el dueño fija
 * un chat, sus agentes también lo ven arriba.
 */
export async function setConversationPinned(conversationId: string, pinned: boolean) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  if (pinned) {
    // Se cuenta antes de escribir. No es a prueba de dos personas fijando en
    // el mismo instante, pero pasarse a 4 no rompe nada — la bandeja las
    // muestra igual y basta con quitar una.
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("pinned_at", "is", null)
      .neq("id", conversationId);

    if ((count ?? 0) >= MAX_PINNED_CONVERSATIONS) {
      return {
        error: `Solo puedes fijar ${MAX_PINNED_CONVERSATIONS} chats. Quita uno para fijar este.`,
      };
    }
  }

  const { error } = await supabase
    .from("conversations")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/inbox");
  return { success: true as const };
}
