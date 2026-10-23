"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { requireWorkspaceRole } from "@/lib/auth/with-workspace";
import { getEnabledModuleKeys } from "@/lib/entitlements";
import { generarLlave } from "@/lib/api-publica/llaves";
import { MODULO_API, permisosValidos } from "@/lib/api-publica/permisos";
import { cifrar } from "@/lib/integraciones/cifrado";
import { eventosValidos } from "@/lib/api-publica/eventos";
import { entregar, generarSecreto, motivoDeUrlInsegura } from "@/lib/api-publica/webhooks";

const MAX_LLAVES_ACTIVAS = 10;
const SOLO_ADMIN = "Solo el dueño o un administrador puede gestionar las llaves de API.";

/**
 * Crea una llave. La llave completa se devuelve UNA sola vez: en la base queda
 * solo su huella, asi que si se pierde hay que crear otra.
 */
export async function crearLlaveApi(input: { nombre: string; permisos: string[]; venceEnDias: number | null }) {
  const ctx = await requireWorkspaceRole(["owner", "admin"], SOLO_ADMIN);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  if (!(await getEnabledModuleKeys(supabase, workspaceId)).includes(MODULO_API)) {
    return { error: "Tu plan no incluye el módulo de API. Contacta a soporte para activarlo." };
  }

  const nombre = input.nombre.trim();
  if (!nombre || nombre.length > 80) return { error: "Ponle un nombre a la llave (hasta 80 caracteres)." };
  const permisos = permisosValidos(input.permisos);
  if (permisos.length === 0) return { error: "Marca al menos un permiso." };
  if (input.venceEnDias !== null && (!Number.isInteger(input.venceEnDias) || input.venceEnDias < 1 || input.venceEnDias > 3650)) {
    return { error: "La duración debe ser de 1 a 3650 días." };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("api_llaves")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("revocada_el", null);
  if ((count ?? 0) >= MAX_LLAVES_ACTIVAS) return { error: `Ya tienes ${MAX_LLAVES_ACTIVAS} llaves activas. Revoca alguna para crear otra.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nueva = generarLlave();
  const { error } = await admin.from("api_llaves").insert({
    workspace_id: workspaceId,
    nombre,
    prefijo: nueva.prefijo,
    huella: nueva.huella,
    permisos,
    creada_por: user?.id ?? null,
    vence_el: input.venceEnDias ? new Date(Date.now() + input.venceEnDias * 86_400_000).toISOString() : null,
  });
  if (error) return { error: "No se pudo crear la llave. Intenta de nuevo." };

  revalidatePath("/dashboard/settings");
  return { success: true as const, llave: nueva.llave };
}

/** Revoca una llave: deja de servir al instante y no se puede reactivar. */
export async function revocarLlaveApi(llaveId: string) {
  const ctx = await requireWorkspaceRole(["owner", "admin"], SOLO_ADMIN);
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await createAdminClient()
    .from("api_llaves")
    .update({ revocada_el: new Date().toISOString() })
    .eq("id", llaveId)
    .eq("workspace_id", ctx.workspaceId)
    .is("revocada_el", null);
  if (error) return { error: "No se pudo revocar la llave." };

  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

/** Tope de peticiones por minuto de un espacio. Solo el administrador de la plataforma. */
export async function guardarLimiteApi(workspaceId: string, limite: number) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };
  if (!Number.isInteger(limite) || limite < 1 || limite > 6000) return { error: "Debe ser un número entre 1 y 6000." };

  const { error } = await createAdminClient()
    .from("api_ajustes")
    .upsert({ workspace_id: workspaceId, limite_por_minuto: limite, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
  if (error) return { error: "No se pudo guardar." };

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { success: true as const };
}

// ---------------------------------------------------------------------------
// Webhooks de salida
// ---------------------------------------------------------------------------

const MAX_WEBHOOKS = 5;

async function conModulo() {
  const ctx = await requireWorkspaceRole(["owner", "admin"], SOLO_ADMIN);
  if ("error" in ctx) return ctx;
  if (!(await getEnabledModuleKeys(ctx.supabase, ctx.workspaceId)).includes(MODULO_API)) {
    return { error: "Tu plan no incluye el módulo de API. Contacta a soporte para activarlo." };
  }
  return ctx;
}

/** Registra un webhook. El secreto de firma se devuelve UNA sola vez. */
export async function crearWebhook(input: { nombre: string; url: string; eventos: string[] }) {
  const ctx = await conModulo();
  if ("error" in ctx) return { error: ctx.error };

  const nombre = input.nombre.trim();
  if (!nombre || nombre.length > 80) return { error: "Ponle un nombre al webhook (hasta 80 caracteres)." };
  const eventos = eventosValidos(input.eventos);
  if (eventos.length === 0) return { error: "Marca al menos un evento." };
  const url = input.url.trim();
  const motivo = await motivoDeUrlInsegura(url);
  if (motivo) return { error: motivo };

  const admin = createAdminClient();
  const { count } = await admin.from("api_webhooks").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspaceId);
  if ((count ?? 0) >= MAX_WEBHOOKS) return { error: `Ya tienes ${MAX_WEBHOOKS} webhooks. Elimina alguno para crear otro.` };

  const secreto = generarSecreto();
  const { error } = await admin
    .from("api_webhooks")
    .insert({ workspace_id: ctx.workspaceId, nombre, url, eventos, secreto_cifrado: cifrar(secreto) });
  if (error) return { error: "No se pudo crear el webhook. Intenta de nuevo." };

  revalidatePath("/dashboard/settings");
  return { success: true as const, secreto };
}

export async function eliminarWebhook(webhookId: string) {
  const ctx = await conModulo();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await createAdminClient().from("api_webhooks").delete().eq("id", webhookId).eq("workspace_id", ctx.workspaceId);
  if (error) return { error: "No se pudo eliminar el webhook." };
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

/** Activa o pausa un webhook. Al reactivarlo se borra el contador de fallos. */
export async function alternarWebhook(webhookId: string, activo: boolean) {
  const ctx = await conModulo();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await createAdminClient()
    .from("api_webhooks")
    .update(activo ? { activo: true, fallos_seguidos: 0, desactivado_motivo: null } : { activo: false, desactivado_motivo: "Pausado manualmente." })
    .eq("id", webhookId)
    .eq("workspace_id", ctx.workspaceId);
  if (error) return { error: "No se pudo cambiar el estado del webhook." };
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}

/** Manda un evento de prueba (`prueba.ping`) ahora mismo y dice como respondio el servidor del cliente. */
export async function enviarPruebaWebhook(webhookId: string) {
  const ctx = await conModulo();
  if ("error" in ctx) return { error: ctx.error };
  const admin = createAdminClient();
  const { data: hook } = await admin.from("api_webhooks").select("id, url, secreto_cifrado").eq("id", webhookId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  if (!hook) return { error: "No se encontró el webhook." };

  const creado = new Date().toISOString();
  const { data: envio } = await admin
    .from("api_webhook_envios")
    .insert({ webhook_id: hook.id, workspace_id: ctx.workspaceId, evento: "prueba.ping", payload: { mensaje: "Evento de prueba de Bybluee CRM." }, estado: "fallido", intentos: 1, creado_el: creado })
    .select("id")
    .single();
  if (!envio) return { error: "No se pudo crear el evento de prueba." };

  const r = await entregar(hook, { id: envio.id, evento: "prueba.ping", payload: { mensaje: "Evento de prueba de Bybluee CRM." }, creado_el: creado });
  await admin
    .from("api_webhook_envios")
    .update({ estado: r.ok ? "enviado" : "fallido", ultimo_codigo: r.codigo, ultimo_error: r.error, enviado_el: r.ok ? new Date().toISOString() : null })
    .eq("id", envio.id);
  revalidatePath("/dashboard/settings");
  return { success: true as const, ok: r.ok, codigo: r.codigo, mensaje: r.error };
}

/** Vuelve a poner en cola un aviso fallido. */
export async function reintentarEnvioWebhook(envioId: string) {
  const ctx = await conModulo();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await createAdminClient()
    .from("api_webhook_envios")
    .update({ estado: "pendiente", intentos: 0, proximo_intento_el: new Date().toISOString(), ultimo_error: null })
    .eq("id", envioId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("estado", "fallido")
    .neq("evento", "prueba.ping");
  if (error) return { error: "No se pudo reintentar." };
  revalidatePath("/dashboard/settings");
  return { success: true as const };
}
