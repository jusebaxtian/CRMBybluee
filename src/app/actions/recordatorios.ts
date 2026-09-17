"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/with-workspace";

/**
 * Recordatorios por contacto (migracion 0110): se programan desde el chat
 * y, al vencer, el trabajo de fondo los convierte en aviso de la campana.
 */

export async function crearRecordatorio(input: { conversationId: string; texto: string; recordarEn: string }) {
  const texto = input.texto.trim();
  if (!texto) return { error: "Escribe qué quieres recordar." };
  if (texto.length > 200) return { error: "Máximo 200 caracteres." };
  const cuando = new Date(input.recordarEn);
  if (Number.isNaN(cuando.getTime())) return { error: "Elige fecha y hora." };
  if (cuando.getTime() < Date.now() + 60_000) return { error: "La fecha debe ser al menos un minuto en el futuro." };

  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, contact_id")
    .eq("id", input.conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!conv) return { error: "Conversación no encontrada." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("recordatorios").insert({
    workspace_id: workspaceId,
    conversation_id: conv.id,
    contact_id: conv.contact_id,
    texto,
    recordar_en: cuando.toISOString(),
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/inbox/${conv.id}`);
  return { success: true as const };
}

export async function eliminarRecordatorio(id: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;
  const { data } = await supabase
    .from("recordatorios")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("conversation_id")
    .maybeSingle();
  if (data) revalidatePath(`/dashboard/inbox/${data.conversation_id}`);
  return { success: true as const };
}

export async function listarRecordatorios(conversationId: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return [];
  const { supabase, workspaceId } = ctx;
  const { data } = await supabase
    .from("recordatorios")
    .select("id, texto, recordar_en")
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .order("recordar_en");
  return (data ?? []) as { id: string; texto: string; recordar_en: string }[];
}
