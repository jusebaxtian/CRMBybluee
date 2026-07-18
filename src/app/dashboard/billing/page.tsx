import { CreditCard, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { createBoldOrder } from "@/app/actions/billing";
import { BoldCheckoutButton } from "@/components/bold-checkout-button";
import { ManualTransferForm } from "@/components/manual-transfer-form";

const statusLabel: Record<string, string> = {
  trialing: "En periodo de prueba",
  active: "Activo",
  past_due: "Pago pendiente",
  canceled: "Cancelado",
};

export default async function BillingPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  const { data: workspaceRow } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("status, trial_ends_at, plans(name, price_cents)")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };

  const workspace = workspaceRow as unknown as
    | { status: string; trial_ends_at: string; plans: { name: string; price_cents: number } | null }
    | null;

  const { data: payments } = await supabase
    .from("payments")
    .select("id, provider, amount_cents, status, created_at")
    .eq("workspace_id", workspaceId ?? "")
    .order("created_at", { ascending: false })
    .limit(10);

  const amountCents = workspace?.plans?.price_cents ?? 0;
  const boldOrder = amountCents > 0 ? await createBoldOrder(amountCents) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">Plan actual</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold text-foreground">
            {workspace?.plans?.name ?? "—"}
          </p>
          <p className="text-sm text-muted">
            ${((workspace?.plans?.price_cents ?? 0) / 100).toLocaleString("es-CO")} COP/mes
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">
          Estado: {workspace ? statusLabel[workspace.status] ?? workspace.status : "—"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <p className="font-medium text-foreground">Pagar con tarjeta (Bold)</p>
          </div>
          <p className="mb-4 text-sm text-muted">
            Pago inmediato, tu cuenta se activa automáticamente.
          </p>
          {boldOrder && "success" in boldOrder ? (
            <BoldCheckoutButton
              orderId={boldOrder.orderId}
              amountCents={boldOrder.amountCents}
              currency={boldOrder.currency}
              signature={boldOrder.signature}
              apiKey={boldOrder.apiKey}
              description={`Suscripción ${workspace?.plans?.name ?? "CRM Bybluee"}`}
            />
          ) : (
            <p className="text-sm text-red-400">No se pudo preparar el pago.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center gap-2">
            <Landmark size={18} className="text-primary" />
            <p className="font-medium text-foreground">Transferencia manual</p>
          </div>
          <p className="mb-3 text-sm text-muted">
            Transfiere a la cuenta de la empresa y sube tu comprobante — lo revisamos y activamos
            tu cuenta manualmente.
          </p>
          <div className="mb-4 rounded-lg border border-border bg-background p-3 text-xs text-muted">
            <p>Nequi: 316 623 0373</p>
            <p>Daviplata: 316 623 0373</p>
            <p>Bre-B: @3166230373</p>
            <p>A nombre de: ByBluee</p>
          </div>
          <ManualTransferForm />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Método</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3 text-muted">
                  {new Date(p.created_at).toLocaleDateString("es-CO")}
                </td>
                <td className="px-5 py-3 text-foreground">
                  {p.provider === "bold" ? "Bold" : "Transferencia"}
                </td>
                <td className="px-5 py-3 text-foreground">
                  ${(p.amount_cents / 100).toLocaleString("es-CO")}
                </td>
                <td className="px-5 py-3 text-muted">{p.status}</td>
              </tr>
            ))}
            {(!payments || payments.length === 0) && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-muted">
                  Sin pagos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
