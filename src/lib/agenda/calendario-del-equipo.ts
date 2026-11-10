import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * En que Google Calendar agenda esta persona (10 nov 2026).
 *
 * Un vendedor (tabla `vendedores`) agenda en el calendario del dueno del espacio:
 * vende para el, y las citas tienen que caer en su agenda. Los demas, en el suyo.
 */
export async function usuarioDeCalendario(supabase: Supabase, workspaceId: string, userId: string): Promise<string> {
  const { data: esVendedor } = await supabase.rpc("soy_vendedor");
  if (!esVendedor) return userId;
  const dueno = await duenoDelEspacio(workspaceId);
  return dueno ?? userId;
}

export async function duenoDelEspacio(workspaceId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/** Nombre visible de quien agendo: su nombre de perfil, o el correo. */
export async function nombresDeUsuarios(ids: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const unicos = [...new Set(ids.filter(Boolean))];
  const pares = await Promise.all(
    unicos.map(async (id): Promise<[string, string]> => {
      const { data } = await admin.auth.admin.getUserById(id);
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      return [id, meta?.full_name?.trim() || data.user?.email || "Alguien del equipo"];
    })
  );
  return new Map(pares);
}

/** La descripcion que va a Google: lo escrito y, al final, quien la agendo. */
export function descripcionParaGoogle(descripcion: string | null | undefined, agendadoPor: string | null): string | null {
  const texto = descripcion?.trim() || "";
  if (!agendadoPor) return texto || null;
  return texto ? `${texto}\n\nAgendado por: ${agendadoPor}` : `Agendado por: ${agendadoPor}`;
}
