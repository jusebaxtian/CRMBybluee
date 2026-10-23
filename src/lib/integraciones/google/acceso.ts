import { createAdminClient } from "@/lib/supabase/admin";
import { descifrar } from "@/lib/integraciones/cifrado";
import { ConexionVencidaError, accesoDesdeRenovacion } from "@/lib/integraciones/google/calendario";

export const MENSAJE_VENCIDA = "Tu conexión con Google venció. Vuelve a conectar en Configuración → Integraciones.";

export type Conexion = { id: string; token_cifrado: string; estado: string };

/**
 * Token de acceso (dura una hora) a partir del permanente guardado cifrado. Si
 * Google dice que ya no vale (la persona quito el acceso), la conexion queda
 * marcada para reconectar.
 */
export async function accesoDeConexion(conexion: Conexion): Promise<{ token: string } | { error: string }> {
  if (conexion.estado !== "conectado") return { error: MENSAJE_VENCIDA };
  try {
    const token = await accesoDesdeRenovacion(
      descifrar(conexion.token_cifrado),
      process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? ""
    );
    return { token };
  } catch (err) {
    if (err instanceof ConexionVencidaError) {
      await createAdminClient().from("integraciones_conexiones").update({ estado: "requiere_reconexion" }).eq("id", conexion.id);
      return { error: MENSAJE_VENCIDA };
    }
    console.error("google calendar: no se pudo obtener acceso:", err instanceof Error ? err.message : err);
    return { error: "No se pudo hablar con Google. Intenta de nuevo en un momento." };
  }
}

export async function conexionDelUsuario(userId: string): Promise<Conexion | null> {
  const { data } = await createAdminClient()
    .from("integraciones_conexiones")
    .select("id, token_cifrado, estado")
    .eq("user_id", userId)
    .eq("proveedor", "google_calendar")
    .maybeSingle();
  return (data as Conexion | null) ?? null;
}

export async function conexionPorId(id: string): Promise<Conexion | null> {
  const { data } = await createAdminClient().from("integraciones_conexiones").select("id, token_cifrado, estado").eq("id", id).maybeSingle();
  return (data as Conexion | null) ?? null;
}
