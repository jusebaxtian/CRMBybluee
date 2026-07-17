"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForToken,
  subscribeAppToWaba,
  getPhoneNumberDetails,
} from "@/lib/whatsapp/graph";

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
