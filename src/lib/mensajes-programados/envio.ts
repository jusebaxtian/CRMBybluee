import { createAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp/graph";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { recordOutboundMessage } from "@/lib/messaging/record";
import { enviarPlantillaAlChat } from "@/lib/whatsapp/enviar-plantilla";
import { isWindowOpen } from "@/lib/whatsapp/message-window";
import { sendPushToUsers } from "@/lib/push/send";

/**
 * Mensajes programados desde el chat (migracion 0177). Corre cada 30 s en el
 * proceso de fondo.
 */

export type ComoEnviar = { tipo: "texto" } | { tipo: "plantilla"; templateId: string } | { tipo: "ninguno"; motivo: string };

/** Con la ventana abierta sale el mensaje libre; cerrada, solo la plantilla. */
export function comoEnviar(p: { texto: string | null; templateId: string | null }, ventanaAbierta: boolean): ComoEnviar {
  if (p.texto && ventanaAbierta) return { tipo: "texto" };
  if (p.templateId) return { tipo: "plantilla", templateId: p.templateId };
  return {
    tipo: "ninguno",
    motivo: "La ventana de 24 h ya estaba cerrada y no elegiste plantilla de respaldo: WhatsApp no deja enviar un mensaje libre.",
  };
}

type Programado = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  contact_id: string;
  texto: string | null;
  template_id: string | null;
  created_by: string | null;
};

type Admin = ReturnType<typeof createAdminClient>;

async function enviarUno(supabase: Admin, m: Programado): Promise<{ como: "texto" | "plantilla" } | { error: string }> {
  const [{ data: conv }, { data: ultimo }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, workspace_id, whatsapp_account_id, contacts(wa_id, bloqueado_el, likely_blocked)")
      .eq("id", m.conversation_id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("created_at")
      .eq("conversation_id", m.conversation_id)
      .eq("direction", "in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!conv) return { error: "El chat ya no existe." };
  const contacto = conv.contacts as unknown as { wa_id: string; bloqueado_el: string | null } | null;
  if (!contacto) return { error: "El contacto ya no existe." };
  if (contacto.bloqueado_el) return { error: "El contacto está bloqueado." };

  const decision = comoEnviar(
    { texto: m.texto, templateId: m.template_id },
    isWindowOpen((ultimo?.created_at as string | undefined) ?? null, Date.now())
  );
  if (decision.tipo === "ninguno") return { error: decision.motivo };

  if (decision.tipo === "plantilla") {
    const r = await enviarPlantillaAlChat(supabase, m.conversation_id, decision.templateId);
    return "error" in r ? { error: r.error } : { como: "plantilla" };
  }

  const account = await resolveSendAccount(supabase, conv.workspace_id as string, conv.whatsapp_account_id as string | null);
  if (!account) return { error: "La línea de WhatsApp ya no está conectada." };
  try {
    const result = await sendTextMessage(account.phone_number_id, account.access_token, contacto.wa_id, m.texto as string);
    await recordOutboundMessage(supabase, {
      conversationId: m.conversation_id,
      messageType: "text",
      body: m.texto,
      waMessageId: result.messages[0]?.id,
      // Lo escribio una persona del equipo, solo que con hora.
      sentBySupport: true,
    });
    return { como: "texto" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function procesarMensajesProgramados() {
  const supabase = createAdminClient();
  const { data: tomados, error } = await supabase.rpc("tomar_mensajes_programados", { p_limite: 20 });
  if (error) {
    console.error("mensajes programados: no se pudieron tomar:", error.message);
    return;
  }

  for (const m of (tomados ?? []) as Programado[]) {
    let r: Awaited<ReturnType<typeof enviarUno>>;
    try {
      r = await enviarUno(supabase, m);
    } catch (err) {
      r = { error: err instanceof Error ? err.message : "Error desconocido." };
    }

    if ("como" in r) {
      await supabase
        .from("mensajes_programados")
        .update({ estado: "enviado", enviado_como: r.como, enviado_el: new Date().toISOString(), error: null })
        .eq("id", m.id);
      continue;
    }

    await supabase.from("mensajes_programados").update({ estado: "fallido", error: r.error.slice(0, 500) }).eq("id", m.id);
    await avisarFallo(supabase, m, r.error);
  }
}

/** Solo a quien lo programo: es su mensaje. */
async function avisarFallo(supabase: Admin, m: Programado, motivo: string) {
  if (!m.created_by) return;
  const { data: c } = await supabase.from("contacts").select("name, wa_id").eq("id", m.contact_id).maybeSingle();
  const quien = (c?.name as string | null)?.trim() || (c?.wa_id as string | undefined) || "contacto";
  const url = `/dashboard/inbox/${m.conversation_id}`;
  await supabase.from("notifications").insert({
    title: `No se envió el mensaje programado a ${quien}`,
    body: motivo.slice(0, 300),
    scope: "workspace",
    target_workspace_id: m.workspace_id,
    target_user_id: m.created_by,
    cta_label: "Ir al chat",
    cta_url: url,
    ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  });
  await sendPushToUsers(supabase, [m.created_by], {
    title: `⚠️ Mensaje programado sin enviar: ${quien}`,
    body: motivo.slice(0, 120),
    url,
    tag: `programado-${m.id}`,
  }).catch(() => 0);
}
