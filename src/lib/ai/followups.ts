import { createAdminClient } from "@/lib/supabase/admin";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp/graph";
import {
  buildFollowupSystemPrompt,
  followupFinalInstruction,
  formatoWhatsApp,
  type ContextoDeSeguimiento,
} from "@/lib/ai/agent";
import {
  LOTE_POR_VUELTA,
  REVISION_MAXIMA_POR_VUELTA,
  clasificarPendientes,
  mensajeQueRepite,
  rellenarPlantilla,
  type ConversacionPendiente,
} from "@/lib/ai/seguimientos";
import { isContactExcludedFromAutomations } from "@/lib/automations/engine";
import { buildTemplateSendParams, motivoDeNoEnviar } from "@/lib/whatsapp/variables";
import type { VariableDePlantilla } from "@/lib/contactos/variables";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { isWindowOpen } from "@/lib/whatsapp/message-window";
import { recordOutboundMessage } from "@/lib/messaging/record";

const HISTORY_LIMIT = 20;
// WhatsApp's customer-service window: free text is only allowed within 24h
// of the customer's own last message — past that, only an approved template
// can reopen the conversation.

export type FollowupStep = { delay_minutes: number; focus: string };

// Polled from instrumentation.ts alongside the automation scheduler — finds
// conversations where the AI agent sent (or was the last to send) a message
// and the customer never replied, and either writes a natural follow-up
// (inside the 24h window, focused on whatever this sequence step calls for)
// or sends the workspace's configured follow-up template (outside it).
export async function processAiFollowups() {
  const supabase = createAdminClient();

  const { data: agents } = await supabase
    .from("ai_agents")
    .select(
      "workspace_id, whatsapp_account_id, provider, api_key, model, agent_name, persona, is_active, followup_enabled, followup_steps, followup_template_id"
    )
    .eq("is_active", true)
    .eq("followup_enabled", true);

  for (const agent of agents ?? []) {
    try {
      await processWorkspaceFollowups(supabase, agent as AgentRow);
    } catch (err) {
      console.error(`AI followup tick failed for workspace=${agent.workspace_id}:`, err);
    }
  }
}

export type AgentRow = {
  workspace_id: string;
  /** null = atiende las lineas sin agente propio (migracion 0118). */
  whatsapp_account_id: string | null;
  provider: "openai" | "anthropic";
  api_key: string;
  model: string;
  agent_name: string;
  persona: string;
  followup_steps: FollowupStep[];
  followup_template_id: string | null;
};

/** Un espacio a la vez. Exportada para poder probar el flujo completo sin recorrer a todos los clientes. */
export async function processWorkspaceFollowups(
  supabase: ReturnType<typeof createAdminClient>,
  agent: AgentRow
) {
  const steps = agent.followup_steps ?? [];
  if (steps.length === 0) return;

  // Lineas que ya tienen agente propio: el agente general no las toca.
  let lineasConAgente: string[] = [];
  if (!agent.whatsapp_account_id) {
    const { data: otros } = await supabase
      .from("ai_agents")
      .select("whatsapp_account_id")
      .eq("workspace_id", agent.workspace_id)
      .not("whatsapp_account_id", "is", null);
    lineasConAgente = (otros ?? []).map((o) => o.whatsapp_account_id as string);
  }

  // Todas las conversaciones con un seguimiento por delante, de la mas antigua a la
  // mas reciente. ANTES se tomaban 25 cualquiera (".limit(25)") y despues se miraba
  // cuales les tocaba: con mas de 25 pendientes siempre eran las mismas 25 y a las
  // demas nunca les llegaba su turno. El corte ahora va DESPUES de elegir las que
  // ya toca enviar.
  const PAGINA = 500;
  const conversations: ConversacionPendiente[] = [];
  for (let desde = 0; desde < 5000; desde += PAGINA) {
    let consulta = supabase
      .from("conversations")
      .select("id, contact_id, whatsapp_account_id, ai_followup_count, ai_followup_started_at")
      .eq("workspace_id", agent.workspace_id)
      .eq("ai_handoff_requested", false)
      .eq("ai_manually_paused", false)
      .eq("followups_enabled", true)
      .eq("last_message_direction", "out")
      .lt("ai_followup_count", steps.length)
      .not("ai_followup_started_at", "is", null)
      .order("ai_followup_started_at", { ascending: true })
      .range(desde, desde + PAGINA - 1);

    if (agent.whatsapp_account_id) {
      consulta = consulta.eq("whatsapp_account_id", agent.whatsapp_account_id);
    } else if (lineasConAgente.length > 0) {
      consulta = consulta.or(`whatsapp_account_id.is.null,whatsapp_account_id.not.in.(${lineasConAgente.join(",")})`);
    }

    const { data: pagina } = await consulta;
    conversations.push(...((pagina ?? []) as ConversacionPendiente[]));
    if (!pagina || pagina.length < PAGINA) break;
  }
  if (conversations.length === 0) return;

  const { tocan, vencidas } = clasificarPendientes(conversations, steps, Date.now());

  // Un seguimiento que se paso de tiempo no se manda tarde: se da por cerrado ese
  // paso (se avanza el contador igual que si se hubiera enviado) y la secuencia
  // sigue con el siguiente. Un "recordatorio de 5 minutos" que sale tres dias
  // despues llega sin contexto y solo molesta.
  let descartadas = 0;
  for (const { conversacion } of vencidas) {
    const { data: cerrada } = await supabase
      .from("conversations")
      .update({ ai_followup_count: conversacion.ai_followup_count + 1 })
      .eq("id", conversacion.id)
      .eq("ai_followup_count", conversacion.ai_followup_count)
      .select("id")
      .maybeSingle();
    if (cerrada) descartadas++;
  }
  if (descartadas > 0) {
    console.warn(`seguimientos IA workspace=${agent.workspace_id}: ${descartadas} paso(s) descartado(s) por llegar demasiado tarde`);
  }

  if (tocan.length === 0) return;
  const due = tocan.map((x) => x.conversacion);

  let template: {
    meta_template_name: string;
    language: string;
    body_text: string | null;
    header_format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    header_media_url: string | null;
    variable_count: number;
    /** Con que se rellena cada {{n}} al enviar. Ver lib/contactos/variables. */
    variables_origen: VariableDePlantilla[] | null;
    buttons: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  } | null = null;
  if (agent.followup_template_id) {
    const { data } = await supabase
      .from("templates")
      .select("meta_template_name, language, body_text, header_format, header_media_url, variable_count, variables_origen, buttons")
      .eq("id", agent.followup_template_id)
      .maybeSingle();
    template = data;
  }

  let procesadas = 0;
  let revisadas = 0;
  for (const conversation of due) {
    // Las excluidas (etiqueta de "no seguimiento", bloqueados...) no gastan lote, pero
    // cada una cuesta consultas: se pone un tope a las que se revisan por vuelta.
    if (procesadas >= LOTE_POR_VUELTA || revisadas >= REVISION_MAXIMA_POR_VUELTA) break;
    revisadas++;
    if (await isContactExcludedFromAutomations(supabase, conversation.contact_id)) continue;

    const step = steps[conversation.ai_followup_count];

    // Claim it first — a slow tick or overlapping run can't double-send the
    // same follow-up, matching the automation scheduler's claim-then-act pattern.
    const { data: claimed } = await supabase
      .from("conversations")
      .update({ ai_followup_count: conversation.ai_followup_count + 1 })
      .eq("id", conversation.id)
      .eq("ai_followup_count", conversation.ai_followup_count)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    procesadas++;

    const account = await resolveSendAccount(supabase, agent.workspace_id, conversation.whatsapp_account_id);
    if (!account) continue;

    try {
      await sendFollowup(
        supabase,
        agent,
        conversation.id,
        conversation.contact_id,
        account,
        template,
        step,
        conversation.ai_followup_count + 1,
        conversation.ai_followup_started_at
      );
    } catch (err) {
      console.error(
        `AI followup send failed conversation=${conversation.id} workspace=${agent.workspace_id}:`,
        err
      );
    }
  }
}

async function sendFollowup(
  supabase: ReturnType<typeof createAdminClient>,
  agent: AgentRow,
  conversationId: string,
  contactId: string,
  account: { phone_number_id: string; access_token: string },
  template: {
    meta_template_name: string;
    language: string;
    body_text: string | null;
    header_format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
    header_media_url: string | null;
    variable_count: number;
    /** Con que se rellena cada {{n}} al enviar. Ver lib/contactos/variables. */
    variables_origen: VariableDePlantilla[] | null;
    buttons: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  } | null,
  step: FollowupStep,
  numero: number,
  sinResponderDesde: string | null
) {
  const { data: contact } = await supabase
    .from("contacts")
    // Las columnas propias: sin ellas la plantilla viaja con el parametro
    // en blanco y Meta la rechaza entera (131008).
    .select("wa_id, name, variable2, variable3, variable4")
    .eq("id", contactId)
    .single();
  if (!contact) return;

  const { data: lastInbound } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const withinWindow =
    isWindowOpen(lastInbound?.created_at ?? null, Date.now());

  if (withinWindow) {
    const { data: pastMessages } = await supabase
      .from("messages")
      .select("direction, body, message_type, exclude_from_followups")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const ordenados = (pastMessages ?? []).reverse().filter((m) => m.body && m.message_type !== "document");
    const history: ChatTurn[] = ordenados.map((m) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: m.body as string,
    }));
    if (history.length === 0) return;

    const { count: mensajesDelCliente } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("direction", "in");

    // Los seguimientos previos son los mensajes automaticos que ya salieron; lo que quedo
    // sin respuesta es lo ultimo que dijo el agente o el equipo ANTES de ellos.
    const previos = ordenados.filter((m) => m.direction === "out" && m.exclude_from_followups).map((m) => m.body as string);
    const ultimoNuestro = [...ordenados].reverse().find((m) => m.direction === "out" && !m.exclude_from_followups)?.body ?? null;
    const ultimoDelCliente = [...ordenados].reverse().find((m) => m.direction === "in")?.body ?? null;
    const minutosSinResponder = sinResponderDesde ? Math.max(1, (Date.now() - new Date(sinResponderDesde).getTime()) / 60_000) : 1;

    const contexto: ContextoDeSeguimiento = {
      numero,
      minutosSinResponder,
      mensajesDelCliente: mensajesDelCliente ?? 0,
      ultimoDelCliente,
      ultimoNuestro,
      seguimientosPrevios: previos,
    };

    const generar = async (ctx: ContextoDeSeguimiento) =>
      formatoWhatsApp(
        (
          await callAiProvider(
            agent.provider,
            agent.api_key,
            agent.model,
            buildFollowupSystemPrompt(agent.agent_name, agent.persona, step.focus, ctx),
            [...history, { role: "user", content: followupFinalInstruction(numero, step.focus, ctx) }]
          )
        )?.trim() ?? ""
      );

    let text: string;
    try {
      text = await generar(contexto);
      // Si el borrador es casi igual a un seguimiento anterior (o a lo ultimo que dijo el
      // agente), se pide una vez mas, diciendolo distinto. Si vuelve a repetirse, mejor no
      // mandar nada que mandar lo mismo: este paso se da por cerrado.
      const anteriores = [...previos, ...(ultimoNuestro ? [ultimoNuestro] : [])];
      const repite = text ? mensajeQueRepite(text, anteriores) : null;
      if (repite) {
        text = await generar({ ...contexto, repiteA: repite });
        if (text && mensajeQueRepite(text, anteriores)) {
          console.warn(`seguimiento IA omitido por repetir un mensaje anterior conversation=${conversationId}`);
          return;
        }
      }
    } catch (err) {
      console.error(`AI followup generation failed for workspace=${agent.workspace_id}:`, err);
      return;
    }
    if (!text) return;

    const result = await sendTextMessage(account.phone_number_id, account.access_token, contact.wa_id, text);
    await recordOutboundMessage(supabase, {
      conversationId,
      messageType: "text",
      body: text,
      waMessageId: result.messages[0]?.id,
      excludeFromFollowups: true,
    });
  } else {
    if (!template) return;

    const headerMedia =
      template.header_format && template.header_format !== "TEXT" && template.header_media_url
        ? {
            type: template.header_format.toLowerCase() as "image" | "video" | "document",
            link: template.header_media_url,
          }
        : undefined;

    const params = buildTemplateSendParams(template, contact);
    // Falta un dato: mejor no mandar el seguimiento que mandarlo roto.
    if (motivoDeNoEnviar(params)) return;

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
      // El texto que de verdad recibio el cliente, con su nombre; no el cuerpo con {{1}}.
      body: rellenarPlantilla(template.body_text, bodyParams),
      mediaUrl: headerMedia?.link ?? null,
      waMessageId: result.messages[0]?.id,
      excludeFromFollowups: true,
    });
  }

}
