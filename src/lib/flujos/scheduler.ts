import { createAdminClient } from "@/lib/supabase/admin";
import { cerrarEjecucionesVencidas, procesarEsperasVencidas } from "@/lib/flujos/motor";

/**
 * El latido de Flujos: lo que hay que hacer cuando pasa el tiempo.
 *
 * Dos cosas, en este orden: seguir a los que se les acabo la espera --que es
 * lo que el cliente esta esperando ver-- y cerrar a los que llevan dias
 * dentro sin avanzar, que es la limpieza que evita dejar contactos atrapados
 * con los seguimientos apagados.
 */
export async function procesarEsperasDeFlujos(): Promise<void> {
  const supabase = createAdminClient();

  const avanzadas = await procesarEsperasVencidas(supabase);
  const cerradas = await cerrarEjecucionesVencidas(supabase);

  if (avanzadas > 0 || cerradas > 0) {
    console.log(`flujos: ${avanzadas} espera(s) continuadas, ${cerradas} ejecucion(es) vencidas`);
  }
}
