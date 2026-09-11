"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { MAX_PINNED_CONVERSATIONS } from "@/lib/inbox/pins";
import { loadInboxPage, type InboxCursor, type InboxFilters } from "@/lib/inbox/load";

/**
 * Fija o quita una conversación de la parte de arriba de la bandeja.
 *
 * El fijado es del espacio de trabajo, no de quien lo pulsa: si el dueño fija
 * un chat, sus agentes también lo ven arriba.
 */
export async function setConversationPinned(conversationId: string, pinned: boolean) {
  const ctx = await requireWorkspace();
  // Se devuelve un literal y no `ctx`: si se retorna el objeto tipado del
  // ayudante, TypeScript infiere otra union y los consumidores que hacen
  // `result?.error` dejan de compilar.
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

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

/**
 * Trae una pagina de la bandeja, ya filtrada.
 *
 * Se pagina por cursor y no por numero de pagina porque la lista se reordena
 * sola: cada mensaje entrante sube su conversacion. Con `offset`, una que
 * subiera entre dos peticiones se veria dos veces, y otra que bajara no se
 * veria nunca.
 *
 * Los filtros van al servidor y no al navegador porque la bandeja esta
 * paginada: filtrar sobre las cuarenta cargadas mostraria resultados de esas
 * cuarenta y no de las 9.991 que existen.
 */
export async function cargarConversaciones(entrada: {
  cursor?: InboxCursor | null;
  filters?: InboxFilters;
}) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { conversations, hayMas } = await loadInboxPage(supabase, workspaceId, {
    cursor: entrada.cursor ?? null,
    filters: entrada.filters,
  });
  return { conversations, hayMas };
}
