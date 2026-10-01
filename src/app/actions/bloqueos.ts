"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { bloquearUsuarios, desbloquearUsuarios } from "@/lib/whatsapp/graph";

/**
 * Bloquear y desbloquear contactos.
 *
 * El bloqueo lo hace Meta: WhatsApp deja de entregarnos los mensajes de esa
 * persona. Aquí solo se guarda el reflejo, y solo si Meta confirmó -- si se
 * guardara antes, el CRM diría "bloqueado" mientras los mensajes siguen
 * llegando, que es peor que no tener la función.
 */
async function contactoDelEspacio(contactId: string) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "Sin espacio de trabajo." as const };

  const { data: contacto } = await supabase
    .from("contacts")
    .select("id, wa_id, name, bloqueado_el")
    .eq("id", contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contacto) return { error: "Contacto no encontrado." as const };

  return { supabase, workspaceId, contacto };
}

/** La línea por la que se bloquea: la del hilo, o la principal del espacio. */
async function lineaDelContacto(supabase: ReturnType<typeof createAdminClient>, workspaceId: string, contactId: string) {
  const { data: conversacion } = await supabase
    .from("conversations")
    .select("whatsapp_account_id")
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return resolveSendAccount(supabase, workspaceId, conversacion?.whatsapp_account_id ?? null);
}

export async function bloquearContacto(contactId: string) {
  const ctx = await contactoDelEspacio(contactId);
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const cuenta = await lineaDelContacto(admin, ctx.workspaceId, contactId);
  if (!cuenta) return { error: "Este espacio no tiene WhatsApp conectado." };

  const numero = (ctx.contacto.wa_id as string).replace(/\D/g, "");
  if (!numero) {
    return { error: "Este contacto tiene el número oculto y Meta no permite bloquearlo." };
  }

  try {
    const resultado = await bloquearUsuarios(cuenta.phone_number_id, cuenta.access_token, [numero]);
    if (resultado.fallidos.length > 0) {
      return { error: resultado.fallidos[0].motivo };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo bloquear." };
  }

  await admin
    .from("contacts")
    .update({ bloqueado_el: new Date().toISOString() })
    .eq("id", contactId);

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/inbox");
  return { ok: true as const };
}

export async function desbloquearContacto(contactId: string) {
  const ctx = await contactoDelEspacio(contactId);
  if ("error" in ctx) return ctx;

  const admin = createAdminClient();
  const cuenta = await lineaDelContacto(admin, ctx.workspaceId, contactId);
  if (!cuenta) return { error: "Este espacio no tiene WhatsApp conectado." };

  const numero = (ctx.contacto.wa_id as string).replace(/\D/g, "");

  try {
    const resultado = await desbloquearUsuarios(cuenta.phone_number_id, cuenta.access_token, [numero]);
    if (resultado.fallidos.length > 0) {
      return { error: resultado.fallidos[0].motivo };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo desbloquear." };
  }

  await admin.from("contacts").update({ bloqueado_el: null }).eq("id", contactId);

  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/inbox");
  return { ok: true as const };
}
