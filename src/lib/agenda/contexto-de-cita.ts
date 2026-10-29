import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { IMPERSONATION_COOKIE } from "@/lib/workspace";

/**
 * Con quien se programan las citas y que correo va por defecto.
 *
 * Normal: la persona que esta usando el CRM y su propio correo de cuenta.
 *
 * Modo soporte (el administrador de la plataforma mirando la cuenta de un cliente): quien
 * esta conectado es el administrador, no el cliente. Su correo NO es el del cliente, y la
 * conexion con Google que se usaria seria la del administrador, asi que una cita creada ahi
 * terminaria en el calendario del administrador. Por eso en modo soporte se muestra el correo
 * con el que el cliente registro su espacio y no se permite crear citas desde ahi.
 */
/**
 * Modo soporte: el dueno del espacio que el administrador esta mirando. Todo lo
 * que es "por usuario" (la conexion con Google, por ejemplo) se lee de el, no
 * del administrador: en soporte se ve SOLO lo del cliente. Fuera de soporte, null.
 */
export async function duenoEnModoSoporte(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null
): Promise<{ userId: string | null } | null> {
  const impersonado = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!workspaceId || !impersonado || impersonado !== workspaceId || !(await isPlatformAdmin(supabase))) return null;
  const { data: dueno } = await createAdminClient()
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  return { userId: (dueno?.user_id as string | undefined) ?? null };
}

/** La conexion con Google Calendar de un usuario (en soporte, la del dueno del espacio). */
export async function conexionGoogleDe(userId: string | null): Promise<{ cuenta_email: string | null; estado: string } | null> {
  if (!userId) return null;
  const { data } = await createAdminClient()
    .from("integraciones_conexiones")
    .select("cuenta_email, estado")
    .eq("user_id", userId)
    .eq("proveedor", "google_calendar")
    .maybeSingle();
  return (data as { cuenta_email: string | null; estado: string } | null) ?? null;
}

export async function contextoDeCita(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null,
  user: { email?: string | null }
): Promise<{ correo: string | null; modoSoporte: boolean }> {
  const dueno = await duenoEnModoSoporte(supabase, workspaceId);
  if (!dueno) return { correo: user.email ?? null, modoSoporte: false };

  let correo: string | null = null;
  if (dueno.userId) {
    const { data } = await createAdminClient().auth.admin.getUserById(dueno.userId);
    correo = data.user?.email ?? null;
  }
  return { correo, modoSoporte: true };
}

export const MENSAJE_MODO_SOPORTE =
  "En modo soporte no se pueden programar citas: se crearían en tu propio Google Calendar. Hazlo desde la cuenta del cliente.";
