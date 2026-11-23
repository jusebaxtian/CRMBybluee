import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pasa a "Inactivo" a los clientes en "Pagó" cuyo plan ya vencio sin renovar
 * (0184). La regla vive en la base (`lead_marcar_inactivos`); el regreso a
 * "Pagó" lo hace el disparador de pagos aprobados, sin esperar este trabajo.
 */
export async function marcarLeadsInactivos(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("lead_marcar_inactivos");
  if (error) {
    console.error("leads inactivos:", error.message);
    return 0;
  }
  const total = Number(data) || 0;
  if (total > 0) console.log(`leads inactivos: ${total} pasaron a Inactivo`);
  return total;
}
