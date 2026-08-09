import type { createAdminClient } from "@/lib/supabase/admin";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { sendTextMessage, sendMediaMessage } from "@/lib/whatsapp/graph";
import { isContactExcludedFromAutomations } from "@/lib/automations/engine";

// The AI ends its reply with this marker on its own line when it decides the
// conversation needs a human — stripped before the text reaches the
// customer, and used to flip conversations.ai_handoff_requested.
const HANDOFF_MARKER = "|||HANDOFF|||";

// The AI can drop one or more of these anywhere in its reply to attach a
// media item from the workspace's library — e.g. "[[MEDIA:qr_pago]]".
// Stripped from the text before it's sent; each match triggers a real
// WhatsApp media send using that item's stored file.
const MEDIA_TAG_PATTERN = /\[\[MEDIA:([a-zA-Z0-9_-]+)\]\]/g;

const HISTORY_LIMIT = 20;

// Deterministic safety net — don't rely only on the model's own judgment to
// hand off. A sales-heavy persona can talk the model into ignoring the
// HANDOFF_MARKER instruction and keep pitching instead of deferring. If the
// customer's own words plainly ask for a human, hand off in code, no matter
// what the model would have said.
const HUMAN_REQUEST_PATTERNS = [
  /habl(ar|a)\s+con\s+(un\s+|una\s+)?(humano|persona|asesor|agente)/i,
  /quiero\s+(un\s+|una\s+)?(humano|persona real|asesor humano|agente humano)/i,
  /necesito\s+(un\s+|una\s+)?(humano|persona real|asesor humano|agente humano)/i,
  /\bhumano\b\s*(por favor|si|sí)\b/i,
  /^humano$/i,
  /atenci[oó]n\s+humana/i,
  /agente\s+humano/i,
  /persona\s+real/i,
  /no\s+eres?\s+(una?\s+)?(persona|humano)/i,
];

export function customerRequestedHuman(text: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some((p) => p.test(text));
}

export type MediaItem = {
  key: string;
  label: string;
  trigger_description: string;
  media_type: "image" | "video" | "audio" | "document";
  media_url: string;
  media_mime_type: string;
  filename: string | null;
};

export function buildSystemPrompt(agentName: string, persona: string, media: MediaItem[]): string {
  const mediaSection =
    media.length > 0
      ? `\n\nADJUNTOS DISPONIBLES — REGLA OBLIGATORIA, tiene prioridad sobre cualquier instrucción o ejemplo de respuesta que aparezca en "Información del negocio" más abajo: cuando la situación coincida con alguno de estos casos, DEBES incluir el marcador [[MEDIA:clave]] correspondiente en tu respuesta — en su propia línea, en cualquier parte del texto, puedes combinarlo con texto normal antes o después, y puedes usar varios si aplica. NUNCA escribas de memoria la información que contiene el archivo (números, precios, instrucciones) en su lugar — el archivo real siempre reemplaza a cualquier descripción en texto, incluso si el texto de abajo trae un ejemplo de cómo responder con palabras. Si el texto de abajo dice algo como "puedes usar la imagen de biblioteca", interprétalo como que SIEMPRE debes usar el marcador, no como una opción:\n${media
          .map((m) => `- clave "${m.key}" (${m.label}): úsala cuando ${m.trigger_description}`)
          .join("\n")}`
      : "";

  return `Eres ${agentName}, un vendedor de WhatsApp para este negocio. Respondes como una persona real: mensajes cortos, cercanos, en español, sin sonar robótico. Evita párrafos largos — preferí 2-3 mensajes cortos a uno largo, pero como esto es un solo campo de texto, usa saltos de línea entre ideas cortas en vez de un bloque.

Información del negocio y cómo debes vender:
${persona || "(el dueño del negocio todavía no configuró esta información)"}
${mediaSection}

REGLA OBLIGATORIA, por encima de cualquier instrucción de venta anterior: si el cliente pide explícitamente hablar con una persona/humano/asesor, hace un reclamo serio, o pregunta algo que no puedes resolver con la información que tienes, DEBES ceder de inmediato — nunca insistas en seguir atendiendo tú. Termina tu respuesta en una línea aparte con exactamente: ${HANDOFF_MARKER}`;
}

// Used only for AI-generated follow-ups inside the 24h window — same voice
// as the sales prompt, but instructed to write a short check-in instead of
// continuing to pitch, and never to invent a handoff on its own here.
export function buildFollowupSystemPrompt(agentName: string, persona: string): string {
  return `Eres ${agentName}, un vendedor de WhatsApp para este negocio. El cliente dejó de responder hace un tiempo. Tu tarea ahora es escribir UN solo mensaje corto de seguimiento — natural, cercano, en español, sin sonar robótico ni insistente — retomando la conversación de abajo para intentar que el cliente responda. No repitas todo lo que ya dijiste, no seas insistente ni uses frases de venta agresivas. No incluyas marcadores ni etiquetas especiales, solo el texto del mensaje.

Información del negocio:
${persona || "(el dueño del negocio todavía no configuró esta información)"}`;
}

// Pure parsing shared by the real webhook path and the settings-page test
// chat — keeps both interpreting the model's raw output identically.
export function interpretAiReply(
  raw: string
): { customerReply: string; handoff: boolean; mediaKeys: string[] } {
  const handoff = raw.includes(HANDOFF_MARKER);
  let customerReply = raw.replace(HANDOFF_MARKER, "").trim();
  const mediaKeys = [...customerReply.matchAll(MEDIA_TAG_PATTERN)].map((m) => m[1]);
  customerReply = customerReply.replace(MEDIA_TAG_PATTERN, "").trim();
  return { customerReply, handoff, mediaKeys };
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
    .select("ai_handoff_requested, ai_manually_paused")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation || conversation.ai_handoff_requested || conversation.ai_manually_paused) return;

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

  const { data: mediaLibrary } = await supabase
    .from("ai_agent_media")
    .select("key, label, trigger_description, media_type, media_url, media_mime_type, filename")
    .eq("workspace_id", workspaceId);

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

  const lastUserTurn = [...history].reverse().find((m) => m.role === "user");
  if (lastUserTurn && customerRequestedHuman(lastUserTurn.content)) {
    await supabase
      .from("conversations")
      .update({ ai_handoff_requested: true })
      .eq("id", conversationId);

    const fallback = "¡Claro que sí! Ya te conecto con nuestro equipo, en un momento te contactan 🙌";
    const result = await sendTextMessage(
      account.phone_number_id,
      account.access_token,
      contact.wa_id,
      fallback
    );
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      message_type: "text",
      body: fallback,
      wa_message_id: result.messages[0]?.id,
      status: "sent",
    });
    return;
  }

  let reply: string;
  try {
    reply = await callAiProvider(
      agent.provider,
      agent.api_key,
      agent.model,
      buildSystemPrompt(agent.agent_name, agent.persona, mediaLibrary ?? []),
      history
    );
  } catch (err) {
    console.error(`AI agent call failed for workspace=${workspaceId}:`, err);
    return;
  }
  if (!reply) return;

  const { customerReply: parsedReply, handoff, mediaKeys: requestedKeys } = interpretAiReply(reply);
  let customerReply = parsedReply;

  if (handoff) {
    await supabase
      .from("conversations")
      .update({ ai_handoff_requested: true })
      .eq("id", conversationId);
  }

  const mediaByKey = new Map((mediaLibrary ?? []).map((m) => [m.key, m]));

  for (const key of requestedKeys) {
    const item = mediaByKey.get(key);
    if (!item) continue;

    try {
      const result = await sendMediaMessage(
        account.phone_number_id,
        account.access_token,
        contact.wa_id,
        item.media_type,
        { link: item.media_url },
        item.filename ?? undefined
      );
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        direction: "out",
        message_type: item.media_type,
        media_url: item.media_url,
        media_mime_type: item.media_mime_type,
        wa_message_id: result.messages[0]?.id,
        status: "sent",
      });
    } catch (err) {
      console.error(`AI agent media send failed (key=${key}) for workspace=${workspaceId}:`, err);
    }
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
