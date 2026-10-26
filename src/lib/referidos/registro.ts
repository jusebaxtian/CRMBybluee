import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { normalizarCodigoDeReferido } from "@/lib/referidos/estado";

export const COOKIE_REFERIDO = "bbl_ref";

/**
 * Deja anotado quien refirio a un espacio recien creado. Nunca lanza: un codigo
 * malo o una falla aqui no debe impedir que la persona termine su registro.
 * Solo se anota una vez (si ya tiene "referido por", no se cambia).
 */
export async function registrarReferido(admin: SupabaseClient, espacioId: string, codigo: unknown): Promise<boolean> {
  try {
    const limpio = normalizarCodigoDeReferido(codigo);
    if (!limpio) return false;
    const { data: quien } = await admin.from("workspaces").select("id").eq("referral_code", limpio).maybeSingle();
    if (!quien || quien.id === espacioId) return false;
    const { data } = await admin
      .from("workspaces")
      .update({ referred_by: quien.id, referred_at: new Date().toISOString() })
      .eq("id", espacioId)
      .is("referred_by", null)
      .select("id");
    return !!data?.length;
  } catch (err) {
    console.error("registrarReferido:", err);
    return false;
  }
}

/** Anota el referido con el codigo guardado en el navegador y lo borra. */
export async function registrarReferidoDeLaCookie(admin: SupabaseClient, espacioId: string): Promise<void> {
  try {
    const jar = await cookies();
    const codigo = jar.get(COOKIE_REFERIDO)?.value;
    if (!codigo) return;
    await registrarReferido(admin, espacioId, codigo);
    jar.delete(COOKIE_REFERIDO);
  } catch (err) {
    console.error("registrarReferidoDeLaCookie:", err);
  }
}
