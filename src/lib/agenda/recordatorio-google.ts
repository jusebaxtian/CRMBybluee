import { accesoDeConexion, conexionDelUsuario, conexionPorId } from "@/lib/integraciones/google/acceso";
import { actualizarEventoDeRecordatorio, borrarEvento, crearEventoDeRecordatorio } from "@/lib/integraciones/google/calendario";

/**
 * Recordatorios del CRM que ademas viven en el Google Calendar de quien los
 * programa, con alarma. Todo es "lo mejor posible": si Google falla, el
 * recordatorio del CRM (el de la campana) queda igual y se avisa.
 */

const URL_DEL_CRM = process.env.NEXT_PUBLIC_SITE_URL || "https://crmbybluee.blue";

export async function crearRecordatorioEnGoogle(
  userId: string,
  d: { recordatorioId: string; texto: string; contacto: string; conversationId: string; inicioIso: string }
): Promise<{ eventId: string; conexionId: string } | { aviso: string }> {
  const conexion = await conexionDelUsuario(userId);
  if (!conexion) return { aviso: "No se agregó a Google Calendar: conecta tu cuenta en Configuración → Integraciones." };
  const acceso = await accesoDeConexion(conexion);
  if ("error" in acceso) return { aviso: `No se agregó a Google Calendar. ${acceso.error}` };
  try {
    const eventId = await crearEventoDeRecordatorio(acceso.token, {
      crmRecordatorioId: d.recordatorioId,
      texto: d.texto,
      descripcion: `Contacto: ${d.contacto}\nChat: ${URL_DEL_CRM}/dashboard/inbox/${d.conversationId}`,
      inicioIso: d.inicioIso,
    });
    return { eventId, conexionId: conexion.id };
  } catch (err) {
    console.error("recordatorio: Google no creó el evento:", err instanceof Error ? err.message : err);
    return { aviso: "El recordatorio quedó en el CRM, pero Google Calendar no pudo crearlo." };
  }
}

export async function moverRecordatorioEnGoogle(conexionId: string, eventId: string, d: { texto: string; inicioIso: string }): Promise<void> {
  const conexion = await conexionPorId(conexionId);
  if (!conexion) return;
  const acceso = await accesoDeConexion(conexion);
  if ("error" in acceso) return;
  await actualizarEventoDeRecordatorio(acceso.token, eventId, d).catch((err) =>
    console.error("recordatorio: Google no movió el evento:", err instanceof Error ? err.message : err)
  );
}

export async function borrarRecordatorioEnGoogle(conexionId: string, eventId: string): Promise<void> {
  const conexion = await conexionPorId(conexionId);
  if (!conexion) return;
  const acceso = await accesoDeConexion(conexion);
  if ("error" in acceso) return;
  await borrarEvento(acceso.token, eventId).catch((err) =>
    console.error("recordatorio: Google no borró el evento:", err instanceof Error ? err.message : err)
  );
}
