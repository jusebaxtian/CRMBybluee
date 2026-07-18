import { NextRequest, NextResponse } from "next/server";
import { verifyBoldWebhookSignature } from "@/lib/bold";
import { createAdminClient } from "@/lib/supabase/admin";

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

  if (payload.type === "SALE_APPROVED") {
    const { data: payment } = await supabase
      .from("payments")
      .select("id, workspace_id, provider, status")
      .eq("bold_order_id", payload.subject)
      .maybeSingle();

    // Idempotent: skip if this order was already processed.
    if (payment && payment.status === "pending") {
      await supabase.from("payments").update({ status: "approved" }).eq("id", payment.id);

      await supabase.from("subscriptions").insert({
        workspace_id: payment.workspace_id,
        provider: "bold",
        external_id: payload.subject,
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
