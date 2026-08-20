"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import {
  exchangeCodeForToken,
  subscribeAppToWaba,
  registerPhoneNumber,
  getPhoneNumberDetails,
  listTemplates,
  sendTemplateMessage,
} from "@/lib/whatsapp/graph";

const ACTIVATION_TEMPLATE_KEY = "activation_notification_template";

export type ActivationField =
  | "plan_name"
  | "activation_date"
  | "expiry_date"
  | "username"
  | "email"
  | "password"
  | "fixed";

export type ActivationTemplateConfig = {
  templateName: string;
  language: string;
  // One entry per {{n}} placeholder, in order. "fixed" entries carry their
  // own literal text instead of pulling from workspace/plan data.
  variables: { field: ActivationField; fixedText?: string }[];
};

export async function connectPlatformWhatsApp(input: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
}) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  try {
    const accessToken = await exchangeCodeForToken(input.code);
    await subscribeAppToWaba(input.wabaId, accessToken);
    // Required for the number to actually send/receive via the Cloud API —
    // see the comment on registerPhoneNumber. Best-effort: some numbers
    // arrive already registered and 4xx here; not worth failing the
    // connection over.
    try {
      await registerPhoneNumber(input.phoneNumberId, accessToken);
    } catch (err) {
      console.error("registerPhoneNumber failed (continuing):", err);
    }
    const phoneDetails = await getPhoneNumberDetails(input.phoneNumberId, accessToken);

    const admin = createAdminClient();
    // Single-row table: clear any previous connection before inserting.
    await admin.from("platform_whatsapp_account").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await admin.from("platform_whatsapp_account").insert({
      waba_id: input.wabaId,
      phone_number_id: input.phoneNumberId,
      display_phone_number: phoneDetails.display_phone_number,
      access_token: accessToken,
      status: "connected",
    });

    if (error) return { error: error.message };

    revalidatePath("/admin/whatsapp");
    return { success: true, displayPhoneNumber: phoneDetails.display_phone_number };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function disconnectPlatformWhatsApp(password: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!password) return { error: "Ingresa tu contraseña para confirmar." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "No se pudo verificar tu sesión." };

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) return { error: "Contraseña incorrecta." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_whatsapp_account")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) return { error: error.message };

  revalidatePath("/admin/whatsapp");
  return { success: true as const };
}

export async function syncPlatformTemplates() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("platform_whatsapp_account")
    .select("waba_id, access_token")
    .maybeSingle();
  if (!account) return { error: "No hay un WhatsApp de administración conectado." };

  try {
    const metaTemplates = await listTemplates(account.waba_id, account.access_token);

    for (const t of metaTemplates) {
      const bodyComponent = t.components.find((c) => c.type === "BODY");
      const bodyText = bodyComponent?.text ?? "";
      const variableCount = (bodyText.match(/\{\{\d+\}\}/g) ?? []).length;

      await admin.from("platform_templates").upsert(
        {
          meta_template_name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          body_text: bodyText,
          variable_count: variableCount,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "meta_template_name,language" }
      );
    }

    revalidatePath("/admin/whatsapp");
    return { success: true, count: metaTemplates.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}

export async function saveActivationTemplateConfig(config: ActivationTemplateConfig) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!config.templateName) return { error: "Selecciona una plantilla." };

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert(
    {
      key: ACTIVATION_TEMPLATE_KEY,
      value: JSON.stringify(config),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) return { error: error.message };
  revalidatePath("/admin/whatsapp");
  return { success: true as const };
}

export async function getActivationTemplateConfig(): Promise<ActivationTemplateConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", ACTIVATION_TEMPLATE_KEY)
    .maybeSingle();
  if (!data?.value) return null;
  try {
    return JSON.parse(data.value) as ActivationTemplateConfig;
  } catch {
    return null;
  }
}

export async function sendActivationNotification(input: {
  workspaceId: string;
  phone: string;
  planName: string;
  activationDate: string;
  expiryDate: string;
  username: string;
  email: string;
  password: string;
}) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!input.phone) return { error: "Este cliente no tiene un número de WhatsApp registrado." };

  const admin = createAdminClient();

  const { data: account } = await admin
    .from("platform_whatsapp_account")
    .select("phone_number_id, access_token")
    .maybeSingle();
  if (!account) return { error: "No hay un WhatsApp de administración conectado." };

  const config = await getActivationTemplateConfig();
  if (!config) return { error: "Configura primero la plantilla de notificación en /admin/whatsapp." };

  const fieldValues: Record<Exclude<ActivationField, "fixed">, string> = {
    plan_name: input.planName,
    activation_date: input.activationDate,
    expiry_date: input.expiryDate,
    username: input.username,
    email: input.email,
    password: input.password,
  };

  const params = config.variables.map((v) =>
    v.field === "fixed" ? v.fixedText ?? "" : fieldValues[v.field]
  );

  try {
    await sendTemplateMessage(
      account.phone_number_id,
      account.access_token,
      input.phone.replace(/[^\d]/g, ""),
      config.templateName,
      config.language,
      params
    );
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido." };
  }
}
