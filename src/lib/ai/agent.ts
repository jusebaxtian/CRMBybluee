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

type MediaItem = {
  key: string;
  label: string;
  trigger_description: string;
  media_type: "image" | "video" | "document";
  media_url: string;
  media_mime_type: string;
  filename: string | null;
};

function buildSystemPrompt(agentName: string, persona: string, media: MediaItem[]): string {
  const mediaSection =
    media.length > 0
      ? `\n\nMedios que puedes enviar (imágenes, videos, documentos). Para adjuntar uno a tu respuesta, incluye en cualquier parte del texto, en su propia línea, exactamente [[MEDIA:clave]] — puedes combinarlo con texto normal antes o después, y puedes usar varios si aplica:\n${media
          .map((m) => `- clave "${m.key}" (${m.label}): úsala cuando ${m.trigger_description}`)
          .join("\n")}`
      : "";

  return `Eres ${agentName}, un vendedor de WhatsApp para este negocio. Respondes como una persona real: mensajes cortos, cercanos, en español, sin sonar robótico. Evita párrafos largos — preferí 2-3 mensajes cortos a uno largo, pero como esto es un solo campo de texto, usa saltos de línea entre ideas cortas en vez de un bloque.

Información del negocio y cómo debes vender:
${persona || "(el dueño del negocio todavía no configuró esta información)"}
${mediaSection}

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

  const handoff = reply.includes(HANDOFF_MARKER);
  let customerReply = reply.replace(HANDOFF_MARKER, "").trim();

  if (handoff) {
    await supabase
      .from("conversations")
      .update({ ai_handoff_requested: true })
      .eq("id", conversationId);
  }

  const mediaByKey = new Map((mediaLibrary ?? []).map((m) => [m.key, m]));
  const requestedKeys = [...customerReply.matchAll(MEDIA_TAG_PATTERN)].map((m) => m[1]);
  customerReply = customerReply.replace(MEDIA_TAG_PATTERN, "").trim();

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
