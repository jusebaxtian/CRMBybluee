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
export async function contextoDeCita(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string | null,
  user: { email?: string | null }
): Promise<{ correo: string | null; modoSoporte: boolean }> {
  const impersonado = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  const modoSoporte = Boolean(workspaceId && impersonado && impersonado === workspaceId && (await isPlatformAdmin(supabase)));
  if (!modoSoporte) return { correo: user.email ?? null, modoSoporte: false };

  const admin = createAdminClient();
  const { data: dueno } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  let correo: string | null = null;
  if (dueno?.user_id) {
    const { data } = await admin.auth.admin.getUserById(dueno.user_id as string);
    correo = data.user?.email ?? null;
  }
  return { correo, modoSoporte: true };
}

export const MENSAJE_MODO_SOPORTE =
  "En modo soporte no se pueden programar citas: se crearían en tu propio Google Calendar. Hazlo desde la cuenta del cliente.";
