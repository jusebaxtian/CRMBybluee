import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONCEPTO_DEL_PAGO, EMISOR } from "@/lib/soporte/emisor";
import type { DatosDeSoporte } from "@/lib/soporte/pdf";

export type SoporteCargado = {
  datos: DatosDeSoporte;
  workspaceId: string;
  /** El cliente todavia no registro sus datos legales (razon social, documento y direccion). */
  sinDocumento: boolean;
};

/** SC-000123: el consecutivo del pago, con ceros a la izquierda. */
export function numeroDeSoporte(consecutivo: number): string {
  return `SC-${String(consecutivo).padStart(6, "0")}`;
}

/**
 * Arma todo lo que lleva el soporte de un pago.
 *
 * El pago se busca con el cliente de sesion, no con el de servicio: asi la
 * seguridad de fila decide quien puede verlo (un miembro del espacio o un
 * administrador de la plataforma) y este codigo no tiene que repetir esa
 * regla. Lo demas --datos del espacio y correo del dueño-- si se lee con el
 * de servicio, porque un agente no puede leer el correo de otro usuario.
 *
 * Devuelve null si el pago no existe, no es visible para quien lo pide o no
 * esta aprobado: un pago pendiente o rechazado no tiene soporte.
 */
export async function cargarDatosDeSoporte(
  supabase: SupabaseClient,
  paymentId: string
): Promise<SoporteCargado | null> {
  const { data: pago } = await supabase
    .from("payments")
    .select(
      "id, workspace_id, provider, amount_cents, currency, status, created_at, reviewed_at, bold_order_id, soporte_numero, plan_id"
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!pago || pago.status !== "approved" || !pago.workspace_id) return null;

  const admin = createAdminClient();
  const { data: espacio } = await admin
    .from("workspaces")
    .select("name, phone, razon_social, documento_tipo, documento_numero, direccion, datos_legales_el")
    .eq("id", pago.workspace_id)
    .maybeSingle();
  if (!espacio) return null;

  const { data: dueno } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", pago.workspace_id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  let correo: string | null = null;
  if (dueno?.user_id) {
    const { data } = await admin.auth.admin.getUserById(dueno.user_id);
    correo = data.user?.email ?? null;
  }

  // El plan que se compro con este pago, si el pago lo guarda. Los anteriores a
  // la migracion 0135 no lo tienen y llevan el concepto generico.
  let nombreDelPlan: string | null = null;
  if (pago.plan_id) {
    const { data: plan } = await admin.from("plans").select("name").eq("id", pago.plan_id).maybeSingle();
    // Los nombres de plan llevan emojis ("PRO ⭐"): el PDF no los dibuja y
    // saldrian como "?". Se dejan letras, numeros y espacios.
    nombreDelPlan = ((plan?.name as string | null) ?? "").replace(/[^\p{L}\p{N}\s.-]/gu, "").replace(/\s+/g, " ").trim() || null;
  }

  // Los datos legales cuentan como registrados cuando el cliente los guardo (o
  // un administrador los cargo): esa marca es la que los bloquea.
  const sinDocumento = !espacio.datos_legales_el;
  return {
    workspaceId: pago.workspace_id as string,
    sinDocumento,
    datos: {
      emisor: EMISOR,
      cliente: {
        nombre: (espacio.razon_social as string | null) || (espacio.name as string) || "Cliente",
        documentoTipo: (espacio.documento_tipo as string | null) ?? null,
        documentoNumero: (espacio.documento_numero as string | null) ?? null,
        direccion: (espacio.direccion as string | null) ?? null,
        correo,
        telefono: (espacio.phone as string | null) ?? null,
      },
      pago: {
        numero: numeroDeSoporte(Number(pago.soporte_numero)),
        // La fecha del pago es la de aprobacion; si se aprobo sola (Bold), la
        // de creacion. Es la misma regla de la pantalla de Pagos del Admin.
        fechaPago: new Date((pago.reviewed_at as string | null) ?? (pago.created_at as string)),
        metodo: pago.provider === "bold" ? "Bold" : "Transferencia",
        referencia: (pago.bold_order_id as string | null) ?? null,
        montoCentavos: Number(pago.amount_cents),
        moneda: (pago.currency as string) || "COP",
        concepto: nombreDelPlan ? `${CONCEPTO_DEL_PAGO} · Plan ${nombreDelPlan}` : CONCEPTO_DEL_PAGO,
      },
    },
  };
}
