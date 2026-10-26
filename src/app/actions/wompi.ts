"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { consultarTransaccionWompi, urlDeCheckoutWompi, wompiConfigurado } from "@/lib/wompi";
import { aplicarTransaccionWompi } from "@/lib/billing/wompi-pago";

/**
 * Arma el cobro de Wompi y devuelve la direccion a la que mandar al cliente.
 * El precio sale del plan en la base (nunca del navegador), como en Bold.
 */
export async function crearPagoWompi(planId: string | null): Promise<{ error: string } | { url: string }> {
  if (!wompiConfigurado()) return { error: "El pago con Wompi no está disponible." };
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: espacio } = await supabase.from("workspaces").select("plan_id").eq("id", workspaceId).maybeSingle();
  const planDelEspacio = (espacio?.plan_id as string | null) ?? null;
  const id = planId ?? planDelEspacio;
  if (!id) return { error: "Elige un plan." };
  const { data: plan } = await supabase
    .from("plans")
    .select("id, price_cents, currency, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!plan || (!plan.is_active && id !== planDelEspacio)) return { error: "Plan no encontrado o no disponible." };
  if (!plan.price_cents || plan.price_cents <= 0) return { error: "Este plan no se puede pagar en línea." };

  const moneda = "COP";
  const montoCentavos = Number(plan.price_cents);
  const referencia = `bbl-${workspaceId.slice(0, 8)}-${Date.now()}`;

  const { error } = await supabase.from("payments").insert({
    workspace_id: workspaceId,
    provider: "wompi",
    amount_cents: montoCentavos,
    currency: moneda,
    status: "pending",
    wompi_reference: referencia,
    plan_id: plan.id,
  });
  if (error) return { error: "No se pudo preparar el pago." };

  return {
    url: urlDeCheckoutWompi({
      referencia,
      montoCentavos,
      moneda,
      urlDeRegreso: "https://crmbybluee.blue/dashboard/billing",
    }),
  };
}

/**
 * Cliente de regreso de Wompi (`?id=<transaccion>`). Se confirma consultando la
 * transaccion a Wompi, no confiando en lo que trae la direccion.
 */
export async function confirmarPagoWompi(transaccionId: string) {
  if (!wompiConfigurado()) return;
  const tx = await consultarTransaccionWompi(transaccionId);
  if (!tx) return;
  await aplicarTransaccionWompi(createAdminClient(), tx);
}
