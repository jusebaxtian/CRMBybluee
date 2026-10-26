import type { SupabaseClient } from "@supabase/supabase-js";
import { activarPorPago } from "@/lib/billing/activar";
import type { TransaccionWompi } from "@/lib/wompi";

/**
 * Aplica el resultado de una transaccion de Wompi a nuestro pago.
 *
 * Lo llaman el aviso de Wompi (webhook) y el regreso del cliente, a veces a la
 * vez: por eso el paso de "pendiente" a "aprobado" es una sola actualizacion
 * condicionada, y solo quien la gana activa el espacio. Wompi manda
 * `amount_in_cents` igual que nosotros (pesos x 100), asi que se compara tal cual.
 */
export async function aplicarTransaccionWompi(
  db: SupabaseClient,
  tx: Pick<TransaccionWompi, "id" | "status" | "reference" | "amount_in_cents" | "currency">
): Promise<"aprobado" | "rechazado" | "pendiente" | "ignorado"> {
  const { data: pago } = await db
    .from("payments")
    .select("id, workspace_id, provider, status, amount_cents, currency, plan_id")
    .eq("wompi_reference", tx.reference)
    .maybeSingle();
  if (!pago || pago.provider !== "wompi") return "ignorado";
  if (pago.status !== "pending") return pago.status === "approved" ? "aprobado" : "rechazado";

  if (tx.status === "APPROVED") {
    // Un monto o moneda distinto al que cobramos no se da por bueno.
    if (Number(tx.amount_in_cents) !== Number(pago.amount_cents) || tx.currency !== pago.currency) {
      return "ignorado";
    }
    const { data: ganado } = await db
      .from("payments")
      .update({ status: "approved", wompi_transaction_id: tx.id })
      .eq("id", pago.id)
      .eq("status", "pending")
      .select("id");
    if (!ganado?.length) return "aprobado";
    await activarPorPago(db, pago, tx.id);
    return "aprobado";
  }

  if (tx.status === "DECLINED" || tx.status === "VOIDED" || tx.status === "ERROR") {
    await db
      .from("payments")
      .update({ status: "rejected", wompi_transaction_id: tx.id })
      .eq("id", pago.id)
      .eq("status", "pending");
    return "rechazado";
  }
  return "pendiente";
}
