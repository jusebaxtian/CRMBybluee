"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBoldIntegritySignature, getBoldTransactionStatus } from "@/lib/bold";
import { addBillingCycle } from "@/lib/billing/cycle";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import { planSeAplica } from "@/lib/billing/cambio-de-plan";

async function getWorkspaceBillingCycle(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data } = await supabase
    .from("workspaces")
    .select("plans(billing_cycle)")
    .eq("id", workspaceId)
    .maybeSingle();
  const plan = data?.plans as unknown as { billing_cycle: string } | null;
  return plan?.billing_cycle ?? "monthly";
}

/**
 * El plan que se va a cobrar, con su precio SACADO DE LA BASE.
 *
 * `createBoldOrder` recibia el monto desde el navegador: una accion de servidor
 * se puede llamar con cualquier argumento, asi que cualquiera podia pedir una
 * orden de Bold por $1 y, al pagarla, quedar activo. Ahora solo se acepta un
 * plan, y su precio sale de aqui. Sin plan, se cobra el que el espacio ya tiene.
 */
async function planParaCobrar(
  supabase: SupabaseClient,
  workspaceId: string,
  planId: string | null
): Promise<{ error: string } | { id: string; name: string; price_cents: number; billing_cycle: string }> {
  const { data: espacio } = await supabase.from("workspaces").select("plan_id").eq("id", workspaceId).maybeSingle();
  const planDelEspacio = (espacio?.plan_id as string | null) ?? null;
  const id = planId ?? planDelEspacio;
  if (!id) return { error: "Elige un plan." };
  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, price_cents, billing_cycle, is_active")
    .eq("id", id)
    .maybeSingle();
  // Un plan que dejo de ofrecerse no se puede comprar, pero si es el que el
  // espacio ya tiene se le deja renovar: quitarlo del catalogo no debe dejar a
  // un cliente sin poder pagar.
  const esElSuyo = id === planDelEspacio;
  if (!plan || (!plan.is_active && !esElSuyo)) return { error: "Plan no encontrado o no disponible." };
  if (!plan.price_cents || plan.price_cents <= 0) return { error: "Este plan no se puede pagar en línea." };
  return {
    id: plan.id as string,
    name: plan.name as string,
    price_cents: Number(plan.price_cents),
    billing_cycle: plan.billing_cycle as string,
  };
}

/**
 * Deja activo el espacio de un pago aprobado, y le pone el plan que compro.
 *
 * El plan del pago solo se aplica si lo pagado es EXACTAMENTE su precio: un
 * pago manual lo escribe el cliente, y sin esta regla bastaria subir un
 * comprobante de $1 marcado como plan superior para que el administrador, al
 * aprobar, regalara el plan. Si no coincide, el espacio se activa con el plan
 * que ya tenia, como antes.
 */
async function activarPorPago(
  db: SupabaseClient,
  pago: { workspace_id: string; provider: string; amount_cents: number; plan_id: string | null },
  externalId?: string
): Promise<{ planAplicado: boolean }> {
  let ciclo: string | null = null;
  let planAplicado = false;
  if (pago.plan_id) {
    const { data: plan } = await db
      .from("plans")
      .select("price_cents, billing_cycle")
      .eq("id", pago.plan_id)
      .maybeSingle();
    if (plan && planSeAplica(Number(plan.price_cents), Number(pago.amount_cents))) {
      await db.from("workspaces").update({ plan_id: pago.plan_id }).eq("id", pago.workspace_id);
      ciclo = plan.billing_cycle as string;
      planAplicado = true;
    }
  }
  if (!ciclo) ciclo = await getWorkspaceBillingCycle(db, pago.workspace_id);

  await db.from("subscriptions").insert({
    workspace_id: pago.workspace_id,
    provider: pago.provider,
    ...(externalId ? { external_id: externalId } : {}),
    status: "active",
    current_period_end: addBillingCycle(new Date(), ciclo).toISOString(),
  });
  await db.from("workspaces").update({ status: "active" }).eq("id", pago.workspace_id);
  return { planAplicado };
}

type BoldOrderResult =
  | { error: string }
  | {
      success: true;
      orderId: string;
      amountCents: number;
      currency: string;
      signature: string;
      apiKey: string;
    };

// Lets a client pick which plan they want before paying — the billing page
// recomputes the amount to charge from whatever plan is now on the
// workspace, so this must run before createBoldOrder/manual transfer.
export async function selectWorkspacePlan(planId: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return { error: "Plan no encontrado o no disponible." };

  const { error } = await supabase
    .from("workspaces")
    .update({ plan_id: planId })
    .eq("id", workspaceId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/billing");
  return { success: true as const };
}

export async function createBoldOrder(planId: string | null): Promise<BoldOrderResult> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const plan = await planParaCobrar(supabase, workspaceId, planId);
  if ("error" in plan) return { error: plan.error };
  const amountCents = plan.price_cents;

  // Our DB/UI store prices as "amount_cents" (COP * 100, e.g. 15000000 = $150.000)
  // for consistent display everywhere else, but Bold's data-amount expects the
  // raw COP integer (their own example: data-amount="30000" for a $30.000
  // charge) — sending the *100 value would overcharge by 100x.
  const boldAmount = Math.round(amountCents / 100);

  const currency = "COP";

  // Reuse a recent pending order instead of minting a new one on every page
  // load/reload — the signature is deterministic so it's safe to recompute
  // for an existing order_id.
  const { data: existing } = await supabase
    .from("payments")
    .select("bold_order_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "bold")
    .eq("status", "pending")
    .eq("amount_cents", amountCents)
    .eq("plan_id", plan.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recentEnough =
    existing && Date.now() - new Date(existing.created_at).getTime() < 30 * 60 * 1000;

  const orderId = recentEnough
    ? existing!.bold_order_id!
    : `ws-${workspaceId.slice(0, 8)}-${Date.now()}`;

  const signature = generateBoldIntegritySignature(orderId, boldAmount, currency);

  if (!recentEnough) {
    await supabase.from("payments").insert({
      workspace_id: workspaceId,
      provider: "bold",
      amount_cents: amountCents,
      currency,
      status: "pending",
      bold_order_id: orderId,
      plan_id: plan.id,
    });
  }

  return {
    success: true as const,
    orderId,
    amountCents: boldAmount,
    currency,
    signature,
    apiKey: process.env.NEXT_PUBLIC_BOLD_IDENTITY_KEY!,
  };
}

// The Bold payment-button widget has no webhook — it redirects back with
// ?bold-order-id=...&bold-tx-status=..., which is what Bold's own docs specify
// as the confirmation mechanism for this product. We'd prefer to double-check
// via their Transaction API, but that requires a separate "API de pagos en
// línea" activation this account doesn't have yet (calls come back with an
// explicit-deny). Until that's activated, we trust the redirect status —
// only for a bold_order_id we generated ourselves and that's still pending,
// which limits it to orders this workspace actually created.
export async function confirmBoldPayment(orderId: string, txStatus: string | null) {
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("id, workspace_id, status, provider, amount_cents, plan_id")
    .eq("bold_order_id", orderId)
    .maybeSingle();

  if (!payment || payment.status !== "pending") return;

  if (txStatus !== "approved") {
    const apiStatus = await getBoldTransactionStatus(orderId);
    if (apiStatus !== "APPROVED") return;
  }

  await admin.from("payments").update({ status: "approved" }).eq("id", payment.id);
  await activarPorPago(admin, payment, orderId);
  // No revalidatePath here: this runs during the billing page's own render
  // (Next.js throws if you call revalidatePath mid-render), and the page
  // queries fresh data right after this returns anyway.
}

export async function uploadPaymentProof(formData: FormData) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const file = formData.get("proof") as File | null;
  const amountStr = String(formData.get("amount") ?? "");
  // El plan que se esta pagando. Sin el, se asume el que el espacio ya tiene.
  const plan = await planParaCobrar(supabase, workspaceId, String(formData.get("planId") ?? "") || null);
  const planId = "error" in plan ? null : plan.id;
  const amountCents = Math.round(Number(amountStr) * 100);

  if (!file || file.size === 0) return { error: "Adjunta un comprobante." };
  if (!amountCents || amountCents <= 0) return { error: "Ingresa el monto pagado." };

  const admin = createAdminClient();
  const path = `${workspaceId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await admin.storage
    .from("payment-proofs")
    .upload(path, file);

  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("payments").insert({
    workspace_id: workspaceId,
    provider: "manual",
    amount_cents: amountCents,
    currency: "COP",
    status: "pending",
    proof_path: path,
    plan_id: planId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/billing");
  return { success: true };
}

export async function approvePayment(paymentId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, workspace_id, provider, amount_cents, currency, plan_id")
    .eq("id", paymentId)
    .single();

  if (!payment) return { error: "Pago no encontrado." };

  await supabase
    .from("payments")
    .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
    .eq("id", paymentId);

  const { planAplicado } = await activarPorPago(supabase, payment);

  revalidatePath("/admin/payments");
  // Si el pago traia un plan pero el monto no coincide con su precio, el
  // espacio se activo con el plan que ya tenia: se le dice al administrador.
  return {
    success: true,
    aviso:
      payment.plan_id && !planAplicado
        ? "El monto no coincide con el precio del plan elegido: se activó la cuenta con su plan actual. Cambia el plan a mano si corresponde."
        : undefined,
  };
}

export async function rejectPayment(paymentId: string) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: "No autorizado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("payments")
    .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
    .eq("id", paymentId);

  revalidatePath("/admin/payments");
  return { success: true };
}
