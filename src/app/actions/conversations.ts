"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth/with-workspace";
import { normalizeWaId } from "@/lib/phone";
import { mensajeDeErrorDeContactos } from "@/lib/billing/demo";
import { abrirConversacion } from "@/lib/whatsapp/conversacion";
import { MAX_PINNED_CONVERSATIONS } from "@/lib/inbox/pins";
import { loadInboxPage, type InboxCursor, type InboxFilters } from "@/lib/inbox/load";

/**
 * Fija o quita una conversación de la parte de arriba de la bandeja.
 *
 * Por defecto el fijado es del espacio de trabajo: si el dueño fija un chat, sus
 * agentes también lo ven arriba. En un espacio con `trabajo_individual` (hoy solo
 * Bybluee, migracion 0166) cada persona tiene sus propios fijados.
 */
export async function setConversationPinned(conversationId: string, pinned: boolean) {
  const ctx = await requireWorkspace();
  // Se devuelve un literal y no `ctx`: si se retorna el objeto tipado del
  // ayudante, TypeScript infiere otra union y los consumidores que hacen
  // `result?.error` dejan de compilar.
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: espacio } = await supabase
    .from("workspaces")
    .select("trabajo_individual")
    .eq("id", workspaceId)
    .maybeSingle();

  if (espacio?.trabajo_individual) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Tu sesión expiró. Vuelve a entrar." };

    if (!pinned) {
      const { error } = await supabase
        .from("conversaciones_fijadas")
        .delete()
        .eq("user_id", user.id)
        .eq("conversation_id", conversationId);
      if (error) return { error: error.message };
      revalidatePath("/dashboard/inbox");
      return { success: true as const };
    }

    const { data: conversacion } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!conversacion) return { error: "Conversación no encontrada." };

    const { count } = await supabase
      .from("conversaciones_fijadas")
      .select("conversation_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .neq("conversation_id", conversationId);
    if ((count ?? 0) >= MAX_PINNED_CONVERSATIONS) {
      return {
        error: `Solo puedes fijar ${MAX_PINNED_CONVERSATIONS} chats. Quita uno para fijar este.`,
      };
    }

    const { error } = await supabase
      .from("conversaciones_fijadas")
      .upsert({ user_id: user.id, conversation_id: conversationId, workspace_id: workspaceId });
    if (error) return { error: error.message };
    revalidatePath("/dashboard/inbox");
    return { success: true as const };
  }

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

/**
 * Marca un chat como no leido (o leido) a mano (0185). La marca es del espacio,
 * como `last_read_at`, y se limpia sola al abrir el chat.
 */
export async function marcarChatNoLeido(conversationId: string, noLeido: boolean) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { error } = await supabase
    .from("conversations")
    .update(noLeido ? { marcado_no_leido: true } : { marcado_no_leido: false, last_read_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId);
  if (error) return { error: "No se pudo cambiar el estado del chat." };
  revalidatePath("/dashboard/inbox", "layout");
  return { success: true as const };
}

/**
 * Al abrir un chat se quita la marca manual de "no leido". Sin revalidar: la
 * lista se entera por el aviso en vivo de `conversations`.
 */
export async function quitarMarcaNoLeidoAlAbrir(conversationId: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return;
  await ctx.supabase
    .from("conversations")
    .update({ marcado_no_leido: false })
    .eq("id", conversationId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("marcado_no_leido", true);
}

/**
 * Guarda un contacto nuevo (o actualiza el nombre de uno que ya existe con ese
 * numero) y, si se pide, abre su chat. El chat se abre sin enviar nada: si el
 * contacto no ha escrito en 24 h, el chat ofrece las plantillas.
 */
export async function guardarContactoDesdeChat(entrada: { nombre: string; telefono: string; abrirChat: boolean }) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const waId = normalizeWaId(entrada.telefono);
  if (!waId) return { error: "Ingresa un número válido con código de país, por ejemplo 57 300 123 4567." };
  const nombre = entrada.nombre.trim();

  const { data: existente } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("wa_id", waId)
    .maybeSingle();

  let contactId = existente?.id as string | undefined;
  if (contactId) {
    // Un nombre vacio no borra el que ya tenia.
    if (nombre && nombre !== existente?.name) {
      await supabase.from("contacts").update({ name: nombre, name_source: "manual" }).eq("id", contactId);
    }
  } else {
    const { data: nuevo, error } = await supabase
      .from("contacts")
      .insert({ workspace_id: workspaceId, wa_id: waId, name: nombre || null, ...(nombre ? { name_source: "manual" } : {}) })
      .select("id")
      .single();
    if (error || !nuevo) return { error: mensajeDeErrorDeContactos(error?.message ?? "") };
    contactId = nuevo.id as string;
  }

  revalidatePath("/dashboard/contacts");
  if (!entrada.abrirChat) return { success: true as const, yaExistia: !!existente, conversationId: null };

  const conversacion = await abrirConversacion(supabase, workspaceId, contactId);
  if (!conversacion) return { error: "Se guardó el contacto, pero no se pudo abrir el chat. ¿Tienes una línea de WhatsApp conectada?" };
  revalidatePath("/dashboard/inbox", "layout");
  return { success: true as const, yaExistia: !!existente, conversationId: conversacion.id };
}

/** Edita nombre y numero del contacto desde el chat. */
export async function editarContactoDesdeChat(contactId: string, nombre: string, telefono: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const waId = normalizeWaId(telefono);
  if (!waId) return { error: "Ingresa un número válido con código de país." };
  const { error } = await supabase
    .from("contacts")
    .update({ name: nombre.trim() || null, wa_id: waId, name_source: nombre.trim() ? "manual" : "whatsapp" })
    .eq("id", contactId)
    .eq("workspace_id", workspaceId);
  if (error) {
    return { error: error.message.includes("duplicate") ? "Ya existe otro contacto con ese número." : "No se pudo guardar el contacto." };
  }
  revalidatePath("/dashboard/inbox", "layout");
  revalidatePath("/dashboard/contacts");
  return { success: true as const };
}

/**
 * Elimina el contacto y, con el, sus chats y mensajes. Solo dueño o
 * administrador del espacio: un agente no borra historial.
 */
export async function eliminarContactoDesdeChat(contactId: string) {
  const ctx = await requireWorkspaceRole(["owner", "admin"], "Solo el dueño o un administrador puede eliminar contactos.");
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { error } = await supabase.rpc("bulk_delete_contacts", {
    p_workspace_id: workspaceId,
    p_contact_ids: [contactId],
  });
  if (error) return { error: "No se pudo eliminar el contacto." };
  revalidatePath("/dashboard/inbox", "layout");
  revalidatePath("/dashboard/contacts");
  return { success: true as const };
}
