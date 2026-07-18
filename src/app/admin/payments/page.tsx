import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentReviewActions } from "@/components/payment-review-actions";

const statusColor: Record<string, string> = {
  pending: "text-warning border-warning",
  approved: "text-success border-success",
  rejected: "text-red-400 border-red-400",
};

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, provider, amount_cents, status, proof_path, created_at, workspaces(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const paymentsWithUrls = await Promise.all(
    (payments ?? []).map(async (p) => {
      let proofUrl: string | null = null;
      if (p.proof_path) {
        const { data } = await admin.storage
          .from("payment-proofs")
          .createSignedUrl(p.proof_path, 60 * 10);
        proofUrl = data?.signedUrl ?? null;
      }
      return { ...p, proofUrl };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pagos</h1>
        <p className="text-sm text-muted">Revisa y aprueba transferencias manuales</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Workspace</th>
              <th className="px-5 py-3 font-medium">Método</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Comprobante</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {paymentsWithUrls.map((p) => {
              const workspace = p.workspaces as unknown as { name: string } | null;
              return (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3 text-foreground">{workspace?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">
                    {p.provider === "bold" ? "Bold" : "Transferencia"}
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    ${(p.amount_cents / 100).toLocaleString("es-CO")}
                  </td>
                  <td className="px-5 py-3">
                    {p.proofUrl ? (
                      <a
                        href={p.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Ver
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusColor[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {p.status === "pending" && p.provider === "manual" && (
                      <PaymentReviewActions paymentId={p.id} />
                    )}
                  </td>
                </tr>
              );
            })}
            {paymentsWithUrls.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-muted">
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
