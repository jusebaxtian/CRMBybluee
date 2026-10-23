import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuenta DEMO: una prueba de pocos dias, sin precio y con limites.
 *
 * Los limites viven en el plan (`plans.is_demo`, `max_contacts`,
 * `max_bulk_sends`, `max_agents`, `max_whatsapp_numbers`), no en el codigo: al
 * pagar, el espacio cambia de plan y los limites desaparecen solos.
 */

/** Duraciones que se pueden dar a un demo. */
export const DIAS_DEMO = [3, 4, 5, 7] as const;

export function diasDemoValidos(dias: number): boolean {
  return (DIAS_DEMO as readonly number[]).includes(dias);
}

/** Lo que dice la base cuando el tope de contactos del plan esta lleno (migracion 0138). */
const MARCA_LIMITE_CONTACTOS = "DEMO_LIMITE_CONTACTOS";

/**
 * Convierte el error del disparador de contactos en una frase para la persona.
 * Cualquier otro error se devuelve tal cual.
 */
export function mensajeDeErrorDeContactos(mensaje: string): string {
  if (!mensaje.includes(MARCA_LIMITE_CONTACTOS)) return mensaje;
  const tope = mensaje.match(new RegExp(`${MARCA_LIMITE_CONTACTOS}:(\\d+)`))?.[1] ?? "100";
  return `Tu cuenta DEMO guarda hasta ${tope} contactos. Activa un plan para tener contactos ilimitados.`;
}

export type LimitesDemo = {
  esDemo: boolean;
  /** null = ilimitado. */
  maxContactos: number | null;
  maxEnviosMasivos: number | null;
};

export async function limitesDelPlan(supabase: SupabaseClient, workspaceId: string): Promise<LimitesDemo> {
  const { data: workspace } = await supabase.from("workspaces").select("plan_id").eq("id", workspaceId).maybeSingle();
  const { data: plan } = workspace?.plan_id
    ? await supabase.from("plans").select("is_demo, max_contacts, max_bulk_sends").eq("id", workspace.plan_id).maybeSingle()
    : { data: null };
  return {
    esDemo: !!plan?.is_demo,
    maxContactos: plan?.max_contacts ?? null,
    maxEnviosMasivos: plan?.max_bulk_sends ?? null,
  };
}

/**
 * Envios masivos ya hechos: destinatarios de campañas que salieron (enviado,
 * entregado o leido). Los fallidos y los pendientes no cuentan.
 */
export async function enviosMasivosHechos(supabase: SupabaseClient, workspaceId: string): Promise<number> {
  const { count } = await supabase
    .from("campaign_recipients")
    .select("id, campaigns!inner(workspace_id)", { count: "exact", head: true })
    .eq("campaigns.workspace_id", workspaceId)
    .in("status", ["sent", "delivered", "read"]);
  return count ?? 0;
}

/**
 * ¿Cabe una campaña con `pendientes` destinatarios en el tope de envios masivos?
 * Devuelve el mensaje de error, o null si cabe (o si el plan no tiene tope).
 */
export function mensajeDeTopeDeEnvios(maxEnvios: number | null, hechos: number, pendientes: number): string | null {
  if (maxEnvios === null) return null;
  const quedan = Math.max(0, maxEnvios - hechos);
  if (pendientes <= quedan) return null;
  if (quedan === 0) {
    return `Tu cuenta DEMO permite ${maxEnvios} envíos masivos y ya los usaste. Activa un plan para enviar sin límite.`;
  }
  return `Tu cuenta DEMO permite ${maxEnvios} envíos masivos y te quedan ${quedan}. Esta campaña tiene ${pendientes} destinatarios: reduce la audiencia o activa un plan para enviar sin límite.`;
}
