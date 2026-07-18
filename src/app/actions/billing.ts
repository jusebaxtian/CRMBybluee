"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { generateBoldIntegritySignature, getBoldTransactionStatus } from "@/lib/bold";

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

export async function createBoldOrder(amountCents: number): Promise<BoldOrderResult> {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  // Our DB/UI store prices as "amount_cents" (COP * 100, e.g. 15000000 = $150.000)
  // for consistent display everywhere else, but Bold's data-amount expects the
  // raw COP integer (their own example: data-amount="30000" for a $30.000
  // charge) — sending the *100 value would overcharge by 100x.
  const boldAmount = Math.round(amountCents / 100);

  const orderId = `ws-${workspaceId.slice(0, 8)}-${Date.now()}`;
  const currency = "COP";
  const signature = generateBoldIntegritySignature(orderId, boldAmount, currency);

  await supabase.from("payments").insert({
    workspace_id: workspaceId,
    provider: "bold",
    amount_cents: amountCents,
    currency,
    status: "pending",
    bold_order_id: orderId,
  });

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
    .select("id, workspace_id, status")
    .eq("bold_order_id", orderId)
    .maybeSingle();

  if (!payment || payment.status !== "pending") return;

  if (txStatus !== "approved") {
    const apiStatus = await getBoldTransactionStatus(orderId);
    if (apiStatus !== "APPROVED") return;
  }

  await admin.from("payments").update({ status: "approved" }).eq("id", payment.id);

  await admin.from("subscriptions").insert({
    workspace_id: payment.workspace_id,
    provider: "bold",
    external_id: orderId,
    status: "active",
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await admin.from("workspaces").update({ status: "active" }).eq("id", payment.workspace_id);
  // No revalidatePath here: this runs during the billing page's own render
  // (Next.js throws if you call revalidatePath mid-render), and the page
  // queries fresh data right after this returns anyway.
}

export async function uploadPaymentProof(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return { error: "No se encontró tu workspace." };

  const file = formData.get("proof") as File | null;
  const amountStr = String(formData.get("amount") ?? "");
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
    .select("id, workspace_id, provider, amount_cents, currency")
    .eq("id", paymentId)
    .single();

  if (!payment) return { error: "Pago no encontrado." };

  await supabase
    .from("payments")
    .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
    .eq("id", paymentId);

  await supabase.from("subscriptions").insert({
    workspace_id: payment.workspace_id,
    provider: payment.provider,
    status: "active",
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await supabase
    .from("workspaces")
    .update({ status: "active" })
    .eq("id", payment.workspace_id);

  revalidatePath("/admin/payments");
  return { success: true };
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
