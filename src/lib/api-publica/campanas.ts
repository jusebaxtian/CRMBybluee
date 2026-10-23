import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCampaignAudience } from "@/lib/campaigns/audience";
import { startCampaignSend } from "@/lib/campaigns/send";
import { noSePuedeUsar, motivoDelExceso } from "@/lib/whatsapp/limite-plantilla";
import type { CodigoError } from "@/lib/api-publica/respuestas";

export const COLUMNAS_CAMPANA = "id, name, status, send_type, scheduled_at, started_at, created_at, whatsapp_account_id, template_id, templates(meta_template_name)";

type FilaCampana = {
  id: string;
  name: string;
  status: string;
  send_type: string;
  scheduled_at: string | null;
  started_at: string | null;
  created_at: string;
  whatsapp_account_id: string | null;
  templates: { meta_template_name: string } | { meta_template_name: string }[] | null;
};

const ESTADOS: Record<string, string> = { draft: "borrador", sending: "enviando", completed: "completada", failed: "fallida" };

export function campanaPublica(f: FilaCampana) {
  const plantilla = Array.isArray(f.templates) ? f.templates[0] : f.templates;
  return {
    id: f.id,
    nombre: f.name,
    estado: ESTADOS[f.status] ?? f.status,
    tipo: f.send_type === "template" ? "plantilla" : "texto",
    plantilla: plantilla?.meta_template_name ?? null,
    linea_id: f.whatsapp_account_id,
    programada_para: f.scheduled_at,
    iniciada_el: f.started_at,
    creada_el: f.created_at,
  };
}

export type ResultadoCampana =
  | { ok: true; campana: ReturnType<typeof campanaPublica> & { destinatarios: number } }
  | { ok: false; codigo: CodigoError; mensaje: string; extra?: Record<string, unknown> };

const falla = (codigo: CodigoError, mensaje: string): ResultadoCampana => ({ ok: false, codigo, mensaje });

async function idsDeEtiquetas(admin: SupabaseClient, workspaceId: string, nombres: unknown, campo: string): Promise<{ ids: string[] } | { motivo: string }> {
  if (nombres === undefined || nombres === null) return { ids: [] };
  if (!Array.isArray(nombres) || nombres.some((n) => typeof n !== "string")) return { motivo: `«${campo}» debe ser una lista de nombres de etiqueta.` };
  if (nombres.length === 0) return { ids: [] };
  const { data } = await admin.from("tags").select("id, name").eq("workspace_id", workspaceId).in("name", nombres as string[]);
  const encontradas = new Map((data ?? []).map((t) => [t.name as string, t.id as string]));
  const faltan = (nombres as string[]).filter((n) => !encontradas.has(n));
  if (faltan.length > 0) return { motivo: `No existen estas etiquetas en «${campo}»: ${faltan.join(", ")}.` };
  return { ids: [...encontradas.values()] };
}

/**
 * Crea una campaña con plantilla por la API. Las reglas son las de crearla desde
 * el CRM: la plantilla debe estar aprobada y pertenecer a la linea, la audiencia
 * se arma con las mismas etiquetas, y una campaña sin destinatarios no se crea.
 */
export async function crearCampanaApi(admin: SupabaseClient, workspaceId: string, c: Record<string, unknown>): Promise<ResultadoCampana> {
  const nombre = typeof c.nombre === "string" ? c.nombre.trim() : "";
  if (!nombre || nombre.length > 120) return falla("peticion_invalida", "«nombre» es obligatorio (hasta 120 caracteres).");

  const p = c.plantilla;
  if (!p || typeof p !== "object" || Array.isArray(p) || typeof (p as { nombre?: unknown }).nombre !== "string") {
    return falla("peticion_invalida", "Falta «plantilla»: un objeto con «nombre» (y, si quieres, «idioma»).");
  }
  const { nombre: nombrePlantilla, idioma } = p as { nombre: string; idioma?: unknown };

  let programada: string | null = null;
  if (c.programada_para !== undefined && c.programada_para !== null) {
    const f = typeof c.programada_para === "string" ? new Date(c.programada_para) : null;
    if (!f || isNaN(f.getTime())) return falla("peticion_invalida", "«programada_para» debe ser una fecha ISO, por ejemplo 2026-11-01T14:00:00Z.");
    if (f.getTime() <= Date.now()) return falla("peticion_invalida", "«programada_para» debe ser en el futuro.");
    programada = f.toISOString();
  }
  if (c.enviar === true && programada) return falla("peticion_invalida", "Usa «enviar»: true o «programada_para», no ambos.");

  // Plantilla aprobada.
  let q = admin.from("templates").select("id, status, body_text, waba_id").eq("workspace_id", workspaceId).eq("meta_template_name", nombrePlantilla);
  if (typeof idioma === "string" && idioma) q = q.eq("language", idioma);
  const { data: candidatas } = await q;
  const plantilla = (candidatas ?? []).find((t) => t.status === "APPROVED") ?? (candidatas ?? [])[0];
  if (!plantilla) return falla("no_encontrado", `No existe la plantilla «${nombrePlantilla}». Consulta GET /api/v1/plantillas.`);
  if (plantilla.status !== "APPROVED") return falla("peticion_invalida", `La plantilla «${nombrePlantilla}» todavía no está aprobada por Meta.`);
  if (noSePuedeUsar(plantilla.body_text)) return falla("peticion_invalida", `Esta plantilla no se puede enviar. ${motivoDelExceso(plantilla.body_text ?? "")}`);

  // Linea: la elegida, o la de la plantilla.
  let lineaId: string | null = null;
  if (c.linea_id !== undefined && c.linea_id !== null) {
    if (typeof c.linea_id !== "string") return falla("peticion_invalida", "«linea_id» debe ser un texto.");
    const { data: linea } = await admin.from("whatsapp_accounts").select("id, waba_id, status").eq("id", c.linea_id).eq("workspace_id", workspaceId).maybeSingle();
    if (!linea || linea.status === "frozen") return falla("sin_linea", "Esa línea no existe en tu cuenta o está desconectada.");
    if (plantilla.waba_id && plantilla.waba_id !== linea.waba_id) return falla("sin_linea", "Esa plantilla no pertenece a la línea elegida.");
    lineaId = linea.id;
  }

  const incluir = await idsDeEtiquetas(admin, workspaceId, c.etiquetas, "etiquetas");
  if ("motivo" in incluir) return falla("peticion_invalida", incluir.motivo);
  const excluir = await idsDeEtiquetas(admin, workspaceId, c.excluir_etiquetas, "excluir_etiquetas");
  if ("motivo" in excluir) return falla("peticion_invalida", excluir.motivo);

  const { data: campana, error } = await admin
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      name: nombre,
      send_type: "template",
      template_id: plantilla.id,
      whatsapp_account_id: lineaId,
      audience_tag_ids: incluir.ids.length > 0 ? incluir.ids : null,
      audience_exclude_tag_ids: excluir.ids.length > 0 ? excluir.ids : null,
      audience_window: "all",
      scheduled_at: programada,
    })
    .select(COLUMNAS_CAMPANA)
    .single();
  if (error || !campana) return falla("error_interno", "No se pudo crear la campaña.");

  const { contactIds } = await resolveCampaignAudience(admin, workspaceId, {
    includeTagIds: incluir.ids,
    excludeTagIds: excluir.ids,
    createdFromRaw: null,
    createdToRaw: null,
    audienceWindow: "all",
  });
  if (contactIds.length === 0) {
    await admin.from("campaigns").delete().eq("id", campana.id);
    return falla("peticion_invalida", "Ningún contacto coincide con la audiencia elegida. Revisa «etiquetas» y «excluir_etiquetas».");
  }

  for (let i = 0; i < contactIds.length; i += 1000) {
    const { error: errorLote } = await admin
      .from("campaign_recipients")
      .insert(contactIds.slice(i, i + 1000).map((id) => ({ campaign_id: campana.id, contact_id: id })));
    if (errorLote) {
      await admin.from("campaigns").delete().eq("id", campana.id);
      return falla("error_interno", "No se pudieron guardar los destinatarios de la campaña.");
    }
  }

  let fila = campana as unknown as FilaCampana;
  if (c.enviar === true) {
    const r = await startCampaignSend(admin, workspaceId, campana.id);
    if ("error" in r) return { ok: false, codigo: "conflicto", mensaje: `La campaña se creó como borrador (${campana.id}) pero no pudo iniciar: ${r.error}` };
    fila = { ...fila, status: "sending" };
  }
  return { ok: true, campana: { ...campanaPublica(fila), destinatarios: contactIds.length } };
}
