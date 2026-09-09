import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentReviewActions } from "@/components/payment-review-actions";
import { toPublicUrl } from "@/lib/supabase/config";

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
    .select("id, provider, amount_cents, status, proof_path, created_at, workspace_id, workspaces(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  // El correo del dueño se resuelve una vez por workspace y no por pago: la
  // misma empresa suele aparecer en varias filas.
  const workspaceIds = [...new Set((payments ?? []).map((p) => p.workspace_id as string))];
  const emailByWorkspace = new Map<string, string>(
    await Promise.all(
      workspaceIds.map(async (id): Promise<[string, string]> => {
        const { data: owner } = await supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();
        if (!owner?.user_id) return [id, "—"];
        const { data } = await admin.auth.admin.getUserById(owner.user_id);
        return [id, data.user?.email ?? "—"];
      })
    )
  );

  const paymentsWithUrls = await Promise.all(
    (payments ?? []).map(async (p) => {
      let proofUrl: string | null = null;
      if (p.proof_path) {
        const { data } = await admin.storage
          .from("payment-proofs")
          .createSignedUrl(p.proof_path, 60 * 10);
        // La URL firmada se arma con la base del cliente que la pide, y en el
        // servidor esa base es la interna (localhost): sin esto el enlace
        // apunta a una dirección que el navegador del admin no alcanza.
        proofUrl = data?.signedUrl ? toPublicUrl(data.signedUrl) : null;
      }
      return { ...p, proofUrl, ownerEmail: emailByWorkspace.get(p.workspace_id as string) ?? "—" };
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
                  <td className="px-5 py-3">
                    <p className="text-foreground">{workspace?.name ?? "—"}</p>
                    <p className="text-xs text-muted">{p.ownerEmail}</p>
                  </td>
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
