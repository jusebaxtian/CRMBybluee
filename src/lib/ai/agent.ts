import type { createAdminClient } from "@/lib/supabase/admin";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { sendTextMessage } from "@/lib/whatsapp/graph";
import { isContactExcludedFromAutomations } from "@/lib/automations/engine";

// The AI ends its reply with this marker on its own line when it decides the
// conversation needs a human — stripped before the text reaches the
// customer, and used to flip conversations.ai_handoff_requested.
const HANDOFF_MARKER = "|||HANDOFF|||";

const HISTORY_LIMIT = 20;

function buildSystemPrompt(agentName: string, persona: string): string {
  return `Eres ${agentName}, un vendedor de WhatsApp para este negocio. Respondes como una persona real: mensajes cortos, cercanos, en español, sin sonar robótico. Evita párrafos largos — preferí 2-3 mensajes cortos a uno largo, pero como esto es un solo campo de texto, usa saltos de línea entre ideas cortas en vez de un bloque.

Información del negocio y cómo debes vender:
${persona || "(el dueño del negocio todavía no configuró esta información)"}

Si el cliente pide explícitamente hablar con una persona, hace un reclamo serio, o pregunta algo que no puedes resolver con la información que tienes, termina tu respuesta en una línea aparte con exactamente: ${HANDOFF_MARKER}`;
}

export async function maybeRespondWithAiAgent(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  conversationId: string,
  contactId: string
) {
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("provider, api_key, model, agent_name, persona, is_active")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!agent || !agent.is_active) return;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("ai_handoff_requested")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation || conversation.ai_handoff_requested) return;

  // A contact tagged "excluir de automatizaciones" (ej: "Ya compró") skips
  // the AI too — same rule as keyword/tag automations and follow-ups.
  if (await isContactExcludedFromAutomations(supabase, contactId)) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("wa_id")
    .eq("id", contactId)
    .single();

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contact || !account) return;

  const { data: pastMessages } = await supabase
    .from("messages")
    .select("direction, body, message_type")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: ChatTurn[] = (pastMessages ?? [])
    .reverse()
    .filter((m) => m.body && m.message_type !== "document")
    .map((m) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body as string }));

  if (history.length === 0) return;

  let reply: string;
  try {
    reply = await callAiProvider(
      agent.provider,
      agent.api_key,
      agent.model,
      buildSystemPrompt(agent.agent_name, agent.persona),
      history
    );
  } catch (err) {
    console.error(`AI agent call failed for workspace=${workspaceId}:`, err);
    return;
  }
  if (!reply) return;

  const handoff = reply.includes(HANDOFF_MARKER);
  const customerReply = reply.replace(HANDOFF_MARKER, "").trim();

  if (handoff) {
    await supabase
      .from("conversations")
      .update({ ai_handoff_requested: true })
      .eq("id", conversationId);
  }

  if (!customerReply) return;

  const result = await sendTextMessage(
    account.phone_number_id,
    account.access_token,
    contact.wa_id,
    customerReply
  );

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "out",
    message_type: "text",
    body: customerReply,
    wa_message_id: result.messages[0]?.id,
    status: "sent",
  });
}
