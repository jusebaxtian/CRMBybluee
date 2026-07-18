import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkspaceRowActions } from "@/components/workspace-row-actions";

const statusColor: Record<string, string> = {
  trialing: "text-warning border-warning",
  active: "text-success border-success",
  past_due: "text-red-400 border-red-400",
  canceled: "text-muted border-border",
};

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, status, access_disabled, created_at, plans(name)")
    .order("created_at", { ascending: false });

  const rows = await Promise.all(
    (workspaces ?? []).map(async (w) => {
      const [{ data: owner }, { data: subscription }] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", w.id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("current_period_end")
          .eq("workspace_id", w.id)
          .eq("status", "active")
          .order("current_period_end", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let email = "—";
      if (owner?.user_id) {
        const { data } = await admin.auth.admin.getUserById(owner.user_id);
        email = data.user?.email ?? "—";
      }

      const plan = w.plans as unknown as { name: string } | null;

      return {
        id: w.id,
        name: w.name,
        email,
        plan: plan?.name ?? "—",
        status: w.status,
        accessDisabled: w.access_disabled,
        createdAt: w.created_at,
        renewalDate: subscription?.current_period_end ?? null,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-sm text-muted">{rows.length} cliente(s) registrados</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Creado</th>
              <th className="px-5 py-3 font-medium">Renovación</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-b-0">
                <td className="px-5 py-3">
                  <p className="text-foreground">{r.email}</p>
                  <p className="text-xs text-muted">{r.name}</p>
                </td>
                <td className="px-5 py-3 text-foreground">{r.plan}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`w-fit rounded-full border px-2 py-0.5 text-xs ${statusColor[r.status] ?? ""}`}
                    >
                      {r.status}
                    </span>
                    {r.accessDisabled && (
                      <span className="w-fit rounded-full border border-red-400 px-2 py-0.5 text-xs text-red-400">
                        Acceso desactivado
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">
                  {new Date(r.createdAt).toLocaleDateString("es-CO")}
                </td>
                <td className="px-5 py-3 text-muted">
                  {r.renewalDate ? new Date(r.renewalDate).toLocaleDateString("es-CO") : "—"}
                </td>
                <td className="px-5 py-3">
                  <WorkspaceRowActions
                    workspaceId={r.id}
                    workspaceName={r.name}
                    accessDisabled={r.accessDisabled}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-muted">
                  Sin clientes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
