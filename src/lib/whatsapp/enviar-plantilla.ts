import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplateMessage } from "@/lib/whatsapp/graph";
import { buildTemplateSendParams, motivoDeNoEnviar } from "@/lib/whatsapp/variables";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { recordOutboundMessage } from "@/lib/messaging/record";

/**
 * Manda una plantilla aprobada al chat y la deja registrada. La usan el chat
 * (con la sesion de la persona, asi las reglas de la base deciden que ve) y los
 * mensajes programados (con el cliente de servicio, desde el proceso de fondo).
 */
export async function enviarPlantillaAlChat(
  supabase: SupabaseClient,
  conversationId: string,
  templateId: string
): Promise<{ success: true } | { error: string }> {
  const [{ data: conversation }, { data: template }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, workspace_id, whatsapp_account_id, contacts(wa_id, name, variable2, variable3, variable4)")
      .eq("id", conversationId)
      .single(),
    supabase
      .from("templates")
      .select("workspace_id, status, meta_template_name, language, body_text, header_format, header_media_url, variable_count, variables_origen, buttons")
      .eq("id", templateId)
      .single(),
  ]);

  if (!conversation) return { error: "Conversación no encontrada." };
  if (!template || template.workspace_id !== conversation.workspace_id) return { error: "Plantilla no encontrada." };
  if (template.status !== "APPROVED") return { error: "La plantilla ya no está aprobada por Meta." };

  const account = await resolveSendAccount(supabase, conversation.workspace_id, conversation.whatsapp_account_id);
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  const contact = conversation.contacts as unknown as {
    wa_id: string;
    name: string | null;
    variable2: string | null;
    variable3: string | null;
    variable4: string | null;
  };

  const headerFormat = template.header_format as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  const headerMedia =
    headerFormat && headerFormat !== "TEXT" && template.header_media_url
      ? {
          type: headerFormat.toLowerCase() as "image" | "video" | "document",
          link: template.header_media_url,
        }
      : undefined;

  try {
    const params = buildTemplateSendParams(template, contact);

    // Un parametro vacio no sale: Meta rechaza el mensaje entero y el cliente
    // solo ve "Falta un dato obligatorio". Se dice que falta y donde.
    const { data: propiasDelEspacio } = await supabase
      .from("variables_personalizadas")
      .select("indice, nombre")
      .eq("workspace_id", conversation.workspace_id);
    const motivo = motivoDeNoEnviar(
      params,
      new Map(
        (propiasDelEspacio ?? []).map((v) => [`variable${v.indice}`, (v.nombre as string) || `Variable ${v.indice}`])
      )
    );
    if (motivo) return { error: motivo };

    const { bodyParams, buttonUrlParam } = params;
    const result = await sendTemplateMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      template.meta_template_name,
      template.language,
      bodyParams,
      headerMedia,
      buttonUrlParam
    );

    await recordOutboundMessage(supabase, {
      conversationId,
      messageType: headerMedia ? headerMedia.type : "template",
      body: template.body_text || `[Plantilla: ${template.meta_template_name}]`,
      mediaUrl: headerMedia?.link ?? null,
      waMessageId: result.messages[0]?.id,
      sentBySupport: true,
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}
