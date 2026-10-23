import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnabledModuleKeys } from "@/lib/entitlements";

export const MODULO_GOOGLE_CALENDAR = "google_calendar";

/**
 * Quien puede conectar su Google: un MIEMBRO del espacio (no un administrador
 * de la plataforma en modo soporte: el calendario es personal) con el modulo
 * incluido en su plan.
 */
export async function espacioParaConectar(
  supabase: SupabaseClient,
  userId: string
): Promise<{ workspaceId: string } | { error: "sin_espacio" | "sin_modulo" }> {
  const { data: membresia } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membresia) return { error: "sin_espacio" };

  const modulos = await getEnabledModuleKeys(supabase as never, membresia.workspace_id);
  if (!modulos.includes(MODULO_GOOGLE_CALENDAR)) return { error: "sin_modulo" };
  return { workspaceId: membresia.workspace_id };
}

/** Direccion publica a la que Google devuelve a la persona (detras de nginx, request.url trae la interna). */
export function origenPublico(headers: Headers, urlDeRespaldo: string): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(urlDeRespaldo).origin;
}

export function uriDeRetorno(origen: string): string {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${origen}/api/google-calendar/callback`;
}
