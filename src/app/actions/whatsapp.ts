"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForToken,
  subscribeAppToWaba,
  getPhoneNumberDetails,
  sendTextMessage,
} from "@/lib/whatsapp/graph";
import { getWorkspaceId } from "@/lib/workspace";

export async function connectWhatsApp(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: "No se encontró tu workspace." };

  try {
    const accessToken = await exchangeCodeForToken(input.code);
    await subscribeAppToWaba(input.wabaId, accessToken);
    const phoneDetails = await getPhoneNumberDetails(
      input.phoneNumberId,
      accessToken
    );

    const { error } = await supabase.from("whatsapp_accounts").upsert(
      {
        workspace_id: membership.workspace_id,
        waba_id: input.wabaId,
        phone_number_id: input.phoneNumberId,
        display_phone_number: phoneDetails.display_phone_number,
        access_token: accessToken,
        status: "connected",
      },
      { onConflict: "workspace_id" }
    );

    if (error) return { error: error.message };

    revalidatePath("/dashboard");
    return { success: true, displayPhoneNumber: phoneDetails.display_phone_number };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

async function sendToConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  workspaceId: string,
  contactWaId: string,
  body: string
) {
  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", workspaceId)
    .single();

  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  try {
    const result = await sendTextMessage(
      account.phone_number_id,
      account.access_token,
      contactWaId,
      body
    );

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      message_type: "text",
      body,
      wa_message_id: result.messages[0]?.id,
      status: "sent",
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    revalidatePath(`/dashboard/inbox/${conversationId}`);
    revalidatePath("/dashboard/inbox");
    return { success: true as const, conversationId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function sendMessage(input: { conversationId: string; body: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, workspace_id, contacts(wa_id)")
    .eq("id", input.conversationId)
    .single();

  if (!conversation) return { error: "Conversación no encontrada." };

  const contactWaId = (conversation.contacts as unknown as { wa_id: string }).wa_id;

  return sendToConversation(
    supabase,
    conversation.id,
    conversation.workspace_id,
    contactWaId,
    input.body
  );
}

export async function sendMessageToContact(input: { contactId: string; body: string }) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, wa_id")
    .eq("id", input.contactId)
    .single();
  if (!contact) return { error: "Contacto no encontrado." };

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .upsert(
      { workspace_id: workspaceId, contact_id: contact.id },
      { onConflict: "workspace_id,contact_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (convError || !conversation) {
    return { error: convError?.message ?? "No se pudo abrir la conversación." };
  }

  return sendToConversation(supabase, conversation.id, workspaceId, contact.wa_id, input.body);
}
