import type { SupabaseClient } from "@supabase/supabase-js";
import { createMetaTemplate } from "@/lib/whatsapp/graph";

export const PLANTILLA_INICIAL = {
  name: "saludo_inicial",
  language: "es",
  category: "MARKETING" as const,
  bodyText: "Hola, ¿Cómo estás?",
};

/**
 * Al conectar la API, todo espacio recibe una plantilla de arranque
 * ("saludo_inicial") para poder escribirle a un contacto fuera de las 24 h
 * sin tener que crear una primero. Se pide a Meta una sola vez por WABA;
 * si ya existe (en Meta o en el CRM) no se repite. Nunca hace fallar la
 * conexion: cualquier error solo queda en el log.
 */
export async function crearPlantillaSaludoInicial(
  supabase: SupabaseClient,
  workspaceId: string,
  wabaId: string,
  accessToken: string
): Promise<void> {
  try {
    const { data: existente } = await supabase
      .from("templates")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("waba_id", wabaId)
      .eq("meta_template_name", PLANTILLA_INICIAL.name)
      .eq("language", PLANTILLA_INICIAL.language)
      .maybeSingle();
    if (existente) return;

    let status = "PENDING";
    try {
      const r = await createMetaTemplate(wabaId, accessToken, PLANTILLA_INICIAL);
      status = r.status;
    } catch (err) {
      // Ya existia en la WABA (creada antes por otra via): se sincroniza
      // en el siguiente "Sincronizar"; cualquier otro error se registra.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|ya existe|duplicate/i.test(msg)) {
        console.error(`plantilla saludo_inicial: Meta rechazo la creacion (workspace ${workspaceId}, waba ${wabaId}): ${msg}`);
        return;
      }
    }

    await supabase.from("templates").upsert(
      {
        workspace_id: workspaceId,
        waba_id: wabaId,
        meta_template_name: PLANTILLA_INICIAL.name,
        language: PLANTILLA_INICIAL.language,
        category: PLANTILLA_INICIAL.category,
        status,
        body_text: PLANTILLA_INICIAL.bodyText,
        variable_count: 0,
        header_format: null,
        header_text: null,
        synced_at: new Date().toISOString(),
        created_via: "crm",
      },
      { onConflict: "workspace_id,waba_id,meta_template_name,language" }
    );
  } catch (err) {
    console.error(`plantilla saludo_inicial: fallo inesperado (workspace ${workspaceId}):`, err);
  }
}
