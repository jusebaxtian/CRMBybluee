"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { buildSystemPrompt, customerRequestedHuman, interpretAiReply } from "@/lib/ai/agent";
import { callAiProvider, type ChatTurn } from "@/lib/ai/providers";
import { limpiarNumerosDePrueba, seccionDeVenta, vendedorDelEspacio } from "@/lib/ai/vendedor";
import { generarAudioMp3, vozDisponible } from "@/lib/ai/voz";
import { decidirAudio } from "@/lib/ai/voz-texto";
import { entregaMediosDePago, quitarNumerosInventados } from "@/lib/ai/numeros-inventados";
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
 * Enciende o apaga al agente. Desde el 9 nov 2026 encenderlo ya no pausa
 * automatizaciones (pueden estar las dos activas). Al apagarlo se reactivan las
 * que la regla vieja habia pausado (marcadas disabled_by_ai).
 */
export async function cambiarVendedorActivo(activo: boolean) {
  const workspaceId = await espacioDelVendedor();
  if (!workspaceId) return { error: "No tienes permiso." };
  const admin = createAdminClient();

  if (activo) {
    const vendedor = await vendedorDelEspacio(admin, workspaceId);
    if (!vendedor) return { error: "No hay una llave de IA conectada en tu espacio." };
    if (!vendedor.instrucciones.trim()) return { error: "Escribe sus instrucciones antes de encenderlo." };
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

export async function guardarVozDelVendedor(vozActiva: boolean, vozId: string) {
  const workspaceId = await espacioDelVendedor();
  if (!workspaceId) return { error: "No tienes permiso." };
  const id = vozId.trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { error: "Ese ID de voz no es válido." };
  const { error } = await createAdminClient()
    .from("agente_vendedor")
    .update({ voz_activa: vozActiva, voz_id: id, actualizado_el: new Date().toISOString() })
    .eq("workspace_id", workspaceId);
  if (error) return { error: "No se pudo guardar la voz." };
  revalidatePath("/admin/agente-juanes");
  return { success: true as const };
}

export async function guardarNumerosDePrueba(entrada: string) {
  const workspaceId = await espacioDelVendedor();
  if (!workspaceId) return { error: "No tienes permiso." };
  const numeros = limpiarNumerosDePrueba(entrada);
  const { error } = await createAdminClient()
    .from("agente_vendedor")
    .update({ numeros_prueba: numeros, actualizado_el: new Date().toISOString() })
    .eq("workspace_id", workspaceId);
  if (error) return { error: "No se pudieron guardar los números." };
  revalidatePath("/admin/agente-juanes");
  return { success: true as const, numeros };
}

/** Chat de prueba: usa las instrucciones escritas en pantalla y no le envia nada a nadie. */
export async function probarVendedor(input: { instrucciones: string; etapa: string; historial: ChatTurn[]; mensaje: string; audioReciente?: boolean }) {
  const workspaceId = await espacioDelVendedor();
  if (!workspaceId) return { error: "No tienes permiso." };
  const admin = createAdminClient();
  const vendedor = await vendedorDelEspacio(admin, workspaceId);
  if (!vendedor) return { error: "No hay una llave de IA conectada en tu espacio." };

  if (customerRequestedHuman(input.mensaje)) {
    return { success: true as const, respuesta: "¡Claro que sí! Ya te conecto con nuestro equipo, en un momento te contactan 🙌", pasaAPersona: true, adjuntos: [] as string[], audioTexto: null, audioBase64: null, quitoNumero: false };
  }

  const conVoz = vendedor.voz_activa && vozDisponible();

  const { data: adjuntos } = await admin
    .from("ai_agent_media")
    .select("key, label, trigger_description, media_type, media_url, media_mime_type, filename")
    .eq("workspace_id", workspaceId);
  // Los adjuntos son por linea: en la prueba, una vez cada clave.
  const porClave = new Map((adjuntos ?? []).map((m) => [m.key as string, m]));
  const biblioteca = [...porClave.values()];

  const instrucciones =
    buildSystemPrompt(vendedor.nombre, input.instrucciones, biblioteca) +
    seccionDeVenta({ nombre: null, etapa: esEtapa(input.etapa) ? input.etapa : "frio", notas: null, etiquetas: [], espacios: [] });
  const turnos: ChatTurn[] = [...input.historial, { role: "user", content: input.mensaje }];

  let crudo: string;
  try {
    crudo = await callAiProvider(vendedor.provider, vendedor.api_key, vendedor.model, instrucciones, turnos);
  } catch {
    return { error: "No se pudo consultar la IA. Revisa la llave conectada en tu espacio." };
  }
  if (!crudo) return { error: "La IA no devolvió ninguna respuesta." };

  const { customerReply, handoff, mediaKeys } = interpretAiReply(crudo);
  // La prueba pasa por los mismos filtros que un chat real.
  const revisada = quitarNumerosInventados(customerReply, `${instrucciones}\n${turnos.map((t) => t.content).join("\n")}`);
  const dePago = revisada.quito || entregaMediosDePago(revisada.texto) ? biblioteca.find((m) => /pago/i.test(`${m.key} ${m.label}`)) : undefined;
  if (dePago && !mediaKeys.includes(dePago.key as string)) mediaKeys.push(dePago.key as string);
  const decision = conVoz
    ? decidirAudio(revisada.texto, { clienteMandoAudio: false, audioReciente: !!input.audioReciente, llevaAdjunto: mediaKeys.length > 0 })
    : { audio: null, texto: revisada.texto };

  // El audio de la prueba se genera de verdad, para oir como queda.
  let audioBase64: string | null = null;
  let texto = decision.texto;
  if (decision.audio) {
    try {
      audioBase64 = (await generarAudioMp3(decision.audio, vendedor.voz_id as string)).toString("base64");
    } catch (err) {
      console.error("probar vendedor: no se pudo generar el audio:", err);
      texto = revisada.texto;
    }
  }

  return {
    success: true as const,
    respuesta: texto,
    audioTexto: audioBase64 ? decision.audio : null,
    audioBase64,
    quitoNumero: revisada.quito,
    pasaAPersona: handoff,
    adjuntos: mediaKeys.map((k) => (porClave.get(k)?.label as string | undefined) ?? k),
  };
}
