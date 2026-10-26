import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { cargarReferidos } from "@/lib/referidos/estado";
import { TarjetaReferidosCliente } from "@/components/referidos/tarjeta-referidos-cliente";

/** Tarjeta "Invita a un amigo": solo para licencias activas y pagadas. */
export async function TarjetaReferidos() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const { elegible, resumen } = await cargarReferidos(supabase, workspaceId);
  if (!elegible || !resumen) return null;

  // Los agentes no manejan la facturacion de la empresa: no ven la invitacion.
  const rol = await getWorkspaceRole(supabase, workspaceId);
  if (rol !== "owner" && rol !== "admin") return null;

  return <TarjetaReferidosCliente {...resumen} puedeCanjear />;
}
