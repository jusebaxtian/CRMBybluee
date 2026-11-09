"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { windowExpiresAt } from "@/lib/whatsapp/message-window";
import { noSePuedeUsar, motivoDelExceso } from "@/lib/whatsapp/limite-plantilla";

/**
 * Mensajes programados desde el chat (migracion 0177). Los envia el proceso de
 * fondo; aqui solo se guardan, se listan y se cancelan.
 */

const DIAS_MAXIMO = 90;

export type MensajeProgramado = {
  id: string;
  enviar_en: string;
  texto: string | null;
  template_id: string | null;
  estado: "pendiente" | "enviando" | "enviado" | "fallido" | "cancelado";
  error: string | null;
};

export async function programarMensaje(input: {
  conversationId: string;
  enviarEn: string;
  texto?: string | null;
  templateId?: string | null;
}): Promise<{ success: true } | { error: string }> {
  const texto = input.texto?.trim() || null;
  const templateId = input.templateId || null;
  if (!texto && !templateId) return { error: "Escribe el mensaje o elige una plantilla." };
  if (texto && texto.length > 4096) return { error: "El mensaje es demasiado largo (máximo 4.096 caracteres)." };

  const cuando = new Date(input.enviarEn);
  if (Number.isNaN(cuando.getTime())) return { error: "Elige fecha y hora." };
  if (cuando.getTime() < Date.now() + 60_000) return { error: "La fecha debe ser al menos un minuto en el futuro." };
  if (cuando.getTime() > Date.now() + DIAS_MAXIMO * 24 * 60 * 60 * 1000) {
    return { error: `Se puede programar hasta ${DIAS_MAXIMO} días adelante.` };
  }

  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const [{ data: conv }, { data: ultimo }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, contact_id, whatsapp_account_id")
      .eq("id", input.conversationId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("created_at")
      .eq("conversation_id", input.conversationId)
      .eq("direction", "in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!conv) return { error: "Conversación no encontrada." };

  // Si para esa hora la ventana ya habra cerrado, el mensaje libre solo sale si
  // el cliente escribe antes. Sin plantilla de respaldo se perderia: se pide.
  const cierra = windowExpiresAt((ultimo?.created_at as string | undefined) ?? null);
  if (texto && !templateId && (!cierra || cierra.getTime() <= cuando.getTime())) {
    return { error: "Para esa hora la ventana de 24 h estará cerrada: elige una plantilla de respaldo." };
  }

  if (templateId) {
    const { data: t } = await supabase
      .from("templates")
      .select("id, status, waba_id, body_text")
      .eq("id", templateId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!t) return { error: "Plantilla no encontrada." };
    if (t.status !== "APPROVED") return { error: "Esa plantilla aún no está aprobada por Meta." };
    const { data: linea } = conv.whatsapp_account_id
      ? await supabase.from("whatsapp_accounts").select("waba_id").eq("id", conv.whatsapp_account_id).maybeSingle()
      : { data: null };
    const waba = (linea?.waba_id as string | null | undefined) ?? null;
    if (t.waba_id && waba && t.waba_id !== waba) return { error: "Esa plantilla no pertenece a la línea de este chat." };
    if (noSePuedeUsar(t.body_text)) return { error: `Esta plantilla no se puede enviar. ${motivoDelExceso(t.body_text)}` };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("mensajes_programados").insert({
    workspace_id: workspaceId,
    conversation_id: conv.id,
    contact_id: conv.contact_id,
    enviar_en: cuando.toISOString(),
    texto,
    template_id: templateId,
    created_by: user?.id ?? null,
  });
  if (error) return { error: "No se pudo programar el mensaje." };

  revalidatePath(`/dashboard/inbox/${conv.id}`);
  return { success: true };
}

/** Los pendientes y los que fallaron en la ultima semana, para verlos en el chat. */
export async function listarMensajesProgramados(conversationId: string): Promise<MensajeProgramado[]> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return [];
  const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await ctx.supabase
    .from("mensajes_programados")
    .select("id, enviar_en, texto, template_id, estado, error")
    .eq("conversation_id", conversationId)
    .or(`estado.in.(pendiente,enviando),and(estado.eq.fallido,enviar_en.gte.${haceUnaSemana})`)
    .order("enviar_en");
  return (data ?? []) as MensajeProgramado[];
}

export async function cancelarMensajeProgramado(id: string): Promise<{ success: true } | { error: string }> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  // Solo si sigue pendiente: uno que ya se esta enviando no se puede detener.
  const { data, error } = await ctx.supabase
    .from("mensajes_programados")
    .update({ estado: "cancelado" })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return { error: "No se pudo cancelar." };
  if (!data || data.length === 0) return { error: "Ese mensaje ya se envió o se está enviando." };
  return { success: true };
}

/** Quitar de la lista uno que fallo (ya se aviso). */
export async function descartarMensajeFallido(id: string): Promise<{ success: true } | { error: string }> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from("mensajes_programados").update({ estado: "cancelado" }).eq("id", id).eq("estado", "fallido");
  if (error) return { error: "No se pudo quitar." };
  return { success: true };
}
