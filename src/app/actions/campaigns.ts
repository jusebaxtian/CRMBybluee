"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp/graph";
import { getWorkspaceId } from "@/lib/workspace";

export async function createCampaign(_prevState: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "");
  const audienceTagId = String(formData.get("audienceTagId") ?? "") || null;

  if (!name || !templateId) return { error: "Nombre y plantilla son obligatorios." };

  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      name,
      template_id: templateId,
      audience_tag_id: audienceTagId,
    })
    .select("id")
    .single();

  if (error || !campaign) return { error: error?.message ?? "Error al crear la campaña." };

  let contactsQuery = supabase.from("contacts").select("id").eq("workspace_id", workspaceId);
  if (audienceTagId) {
    const { data: taggedContacts } = await supabase
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", audienceTagId);
    const ids = (taggedContacts ?? []).map((c) => c.contact_id);
    contactsQuery = contactsQuery.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: contacts } = await contactsQuery;

  if (contacts && contacts.length > 0) {
    await supabase.from("campaign_recipients").insert(
      contacts.map((c) => ({ campaign_id: campaign.id, contact_id: c.id }))
    );
  }

  redirect(`/dashboard/campaigns/${campaign.id}`);
}

export async function sendCampaign(campaignId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No autenticado." };

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, templates(meta_template_name, language)")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { error: "Campaña no encontrada." };

  const template = campaign.templates as unknown as {
    meta_template_name: string;
    language: string;
  };

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("workspace_id", workspaceId)
    .single();
  if (!account) return { error: "Este workspace no tiene WhatsApp conectado." };

  await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaignId);

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, contacts(wa_id)")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  let failures = 0;

  for (const recipient of recipients ?? []) {
    const waId = (recipient.contacts as unknown as { wa_id: string }).wa_id;
    try {
      await sendTemplateMessage(
        account.phone_number_id,
        account.access_token,
        waId,
        template.meta_template_name,
        template.language
      );
      await supabase
        .from("campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);
    } catch (err) {
      failures += 1;
      await supabase
        .from("campaign_recipients")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Error desconocido.",
        })
        .eq("id", recipient.id);
    }
  }

  await supabase
    .from("campaigns")
    .update({ status: failures > 0 && recipients?.length === failures ? "failed" : "completed" })
    .eq("id", campaignId);

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return { success: true };
}
