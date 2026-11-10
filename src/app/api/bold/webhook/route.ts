import { NextRequest, NextResponse } from "next/server";
import { verifyBoldWebhookSignature } from "@/lib/bold";
import { createAdminClient } from "@/lib/supabase/admin";
import { addBillingCycle } from "@/lib/billing/cycle";
import { estadoTrasEvento, filaDeAviso, type EstadoBold, type PayloadBold } from "@/lib/bold-pagos";

async function guardarAviso(supabase: ReturnType<typeof createAdminClient>, payload: PayloadBold) {
  const fila = filaDeAviso(payload);
  if (!fila) return;
  const { data: anterior } = await supabase.from("bold_pagos").select("estado").eq("payment_id", fila.payment_id).maybeSingle();
  const estado = estadoTrasEvento((anterior?.estado as EstadoBold | undefined) ?? null, payload.type);
  // Un aviso repetido con menos datos no borra lo que ya se sabia del pago.
  const conDatos = Object.fromEntries(Object.entries(fila).filter(([, v]) => v !== null));
  const { error } = await supabase
    .from("bold_pagos")
    .upsert({ ...conDatos, estado, payload, updated_at: new Date().toISOString() }, { onConflict: "payment_id" });
  if (error) throw new Error(error.message);
}

type BoldWebhookPayload = {
  id: string;
  type: "SALE_APPROVED" | "SALE_REJECTED" | "VOID_APPROVED" | "VOID_REJECTED";
  subject: string;
  data: { payment_id?: string; metadata?: { reference?: string } };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifyBoldWebhookSignature(rawBody, request.headers.get("x-bold-signature"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody) as BoldWebhookPayload;
  const supabase = createAdminClient();

  // Todo pago en linea queda guardado (0180), sea del producto que sea: se ve en
  // Admin -> Pagos. Un fallo aqui no debe frenar la activacion de abajo.
  await guardarAviso(supabase, JSON.parse(rawBody) as PayloadBold).catch((err) =>
    console.error("bold webhook: no se pudo guardar el aviso:", err)
  );

  if (payload.type === "SALE_APPROVED") {
    const { data: payment } = await supabase
      .from("payments")
      .select("id, workspace_id, provider, status")
      .eq("bold_order_id", payload.subject)
      .maybeSingle();

    // Idempotent: skip if this order was already processed.
    if (payment && payment.status === "pending") {
      await supabase.from("payments").update({ status: "approved" }).eq("id", payment.id);

      const { data: workspaceRow } = await supabase
        .from("workspaces")
        .select("plans(billing_cycle)")
        .eq("id", payment.workspace_id)
        .maybeSingle();
      const plan = workspaceRow?.plans as unknown as { billing_cycle: string } | null;
      const cycle = plan?.billing_cycle ?? "monthly";

      await supabase.from("subscriptions").insert({
        workspace_id: payment.workspace_id,
        provider: "bold",
        external_id: payload.subject,
        status: "active",
        current_period_end: addBillingCycle(new Date(), cycle).toISOString(),
      });

      await supabase
        .from("workspaces")
        .update({ status: "active" })
        .eq("id", payment.workspace_id);
    }
  }

  if (payload.type === "SALE_REJECTED") {
    await supabase
      .from("payments")
      .update({ status: "rejected" })
      .eq("bold_order_id", payload.subject);
  }

  return new NextResponse("OK", { status: 200 });
}
