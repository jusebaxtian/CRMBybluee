"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { buildSystemPrompt, customerRequestedHuman, interpretAiReply } from "@/lib/ai/agent";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { seccionDeVenta, vendedorDelEspacio } from "@/lib/ai/vendedor";
import { esEtapa } from "@/lib/leads/etapas";

/** Solo el administrador de la plataforma, y sobre el espacio que tiene agente vendedor. */
async function espacioDelVendedor() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;
  const { data } = await supabase.from("agente_vendedor").select("workspace_id").limit(1).maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

export async function guardarInstruccionesDelVendedor(instrucciones: string) {
  const workspaceId = await espacioDelVendedor();
  if (!workspaceId) return { error: "No tienes permiso." };
  const { error } = await createAdminClient()
    .from("agente_vendedor")
    .update({ instrucciones, actualizado_el: new Date().toISOString() })
    .eq("workspace_id", workspaceId);
  if (error) return { error: "No se pudieron guardar las instrucciones." };
  revalidatePath("/admin/agente-juanes");
  return { success: true as const };
}

/**
 * Enciende o apaga al agente. Como con los agentes por linea, solo uno responde a
 * la vez: al encenderlo se pausan las automatizaciones de palabra clave y etiqueta
 * (marcadas disabled_by_ai) y al apagarlo vuelven.
 */
export async function cambiarVendedorActivo(activo: boolean) {
  const workspaceId = await espacioDelVendedor();
  if (!workspaceId) return { error: "No tienes permiso." };
  const admin = createAdminClient();

  if (activo) {
    const vendedor = await vendedorDelEspacio(admin, workspaceId);
    if (!vendedor) return { error: "No hay una llave de IA conectada en tu espacio." };
    if (!vendedor.instrucciones.trim()) return { error: "Escribe sus instrucciones antes de encenderlo." };
    const { error } = await admin
      .from("automations")
      .update({ is_active: false, disabled_by_ai: true })
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .in("trigger_type", ["keyword", "tag_added"]);
    if (error) return { error: "No se pudieron pausar las automatizaciones; no se encendió." };
  }

  const { error } = await admin.from("agente_vendedor").update({ activo, actualizado_el: new Date().toISOString() }).eq("workspace_id", workspaceId);
  if (error) return { error: "No se pudo cambiar el estado." };

  if (!activo) {
    const { error: errorAlRestaurar } = await admin
      .from("automations")
      .update({ is_active: true, disabled_by_ai: false })
      .eq("workspace_id", workspaceId)
      .eq("disabled_by_ai", true);
    if (errorAlRestaurar) return { error: "Se apagó, pero no se pudieron reactivar las automatizaciones." };
  }

  revalidatePath("/admin/agente-juanes");
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/inbox", "layout");
  return { success: true as const };
}

/** Chat de prueba: usa las instrucciones escritas en pantalla y no le envia nada a nadie. */
export async function probarVendedor(input: { instrucciones: string; etapa: string; historial: ChatTurn[]; mensaje: string }) {
  const workspaceId = await espacioDelVendedor();
  if (!workspaceId) return { error: "No tienes permiso." };
  const admin = createAdminClient();
  const vendedor = await vendedorDelEspacio(admin, workspaceId);
  if (!vendedor) return { error: "No hay una llave de IA conectada en tu espacio." };

  if (customerRequestedHuman(input.mensaje)) {
    return { success: true as const, respuesta: "¡Claro que sí! Ya te conecto con nuestro equipo, en un momento te contactan 🙌", pasaAPersona: true, adjuntos: [] as string[] };
  }

  const { data: adjuntos } = await admin
    .from("ai_agent_media")
    .select("key, label, trigger_description, media_type, media_url, media_mime_type, filename")
    .eq("workspace_id", workspaceId);
  // Los adjuntos son por linea: en la prueba, una vez cada clave.
  const porClave = new Map((adjuntos ?? []).map((m) => [m.key as string, m]));
  const biblioteca = [...porClave.values()];

  let crudo: string;
  try {
    crudo = await callAiProvider(
      vendedor.provider,
      vendedor.api_key,
      vendedor.model,
      buildSystemPrompt(vendedor.nombre, input.instrucciones, biblioteca) +
        seccionDeVenta({ nombre: null, etapa: esEtapa(input.etapa) ? input.etapa : "frio", notas: null, etiquetas: [], espacios: [] }),
      [...input.historial, { role: "user", content: input.mensaje }]
    );
  } catch {
    return { error: "No se pudo consultar la IA. Revisa la llave conectada en tu espacio." };
  }
  if (!crudo) return { error: "La IA no devolvió ninguna respuesta." };

  const { customerReply, handoff, mediaKeys } = interpretAiReply(crudo);
  return {
    success: true as const,
    respuesta: customerReply,
    pasaAPersona: handoff,
    adjuntos: mediaKeys.map((k) => (porClave.get(k)?.label as string | undefined) ?? k),
  };
}
