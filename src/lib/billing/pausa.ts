import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cuenta pausada (16 nov 2026): se le vencio el plan y no ha pagado, se cancelo
 * o la desactivo el administrador. Mientras tanto no corre nada automatico:
 * ni IA, ni flujos, ni automatizaciones, ni seguimientos, ni campañas, ni
 * mensajes programados. Los mensajes que le escriben se siguen guardando, y lo
 * pendiente no se descarta: vuelve a correr solo cuando la cuenta se activa.
 *
 * La misma regla vive en SQL (`espacio_pausado`, migracion 0182) para los
 * trabajos que toman sus pendientes desde la base.
 */
export const ESTADOS_PAUSADOS = ["past_due", "canceled", "suspended"] as const;

export function estaPausado(espacio: { status?: string | null; access_disabled?: boolean | null } | null | undefined): boolean {
  if (!espacio) return false;
  return !!espacio.access_disabled || (ESTADOS_PAUSADOS as readonly string[]).includes(espacio.status ?? "");
}

export async function espacioPausado(supabase: SupabaseClient, workspaceId: string): Promise<boolean> {
  const { data } = await supabase.from("workspaces").select("status, access_disabled").eq("id", workspaceId).maybeSingle();
  return estaPausado(data);
}

/** Ids de todas las cuentas pausadas, para sacarlas de una consulta de pendientes. */
export async function idsDeEspaciosPausados(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .or(`status.in.(${ESTADOS_PAUSADOS.join(",")}),access_disabled.eq.true`);
  return (data ?? []).map((w) => w.id as string);
}

/** El valor para `.not(columna, "in", ...)`; null si no hay ninguna pausada. */
export function listaParaExcluir(ids: string[]): string | null {
  return ids.length ? `(${ids.join(",")})` : null;
}
