import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkspaceRowActions } from "@/components/workspace-row-actions";

const statusColor: Record<string, string> = {
  trialing: "text-warning border-warning",
  active: "text-success border-success",
  past_due: "text-red-400 border-red-400",
  canceled: "text-muted border-border",
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, status, access_disabled, created_at, trial_ends_at, signup_ip, plans(name)")
    .order("created_at", { ascending: false });

  const ipCounts = new Map<string, number>();
  for (const w of workspaces ?? []) {
    if (w.signup_ip) ipCounts.set(w.signup_ip, (ipCounts.get(w.signup_ip) ?? 0) + 1);
  }

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
        renewalDate: subscription?.current_period_end ?? w.trial_ends_at ?? null,
        signupIp: w.signup_ip,
        sharedIp: w.signup_ip ? (ipCounts.get(w.signup_ip) ?? 0) > 1 : false,
      };
    })
  );

  const query = (q ?? "").trim().toLowerCase();
  const filteredRows = query
    ? rows.filter((r) => r.email.toLowerCase().includes(query))
    : rows;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-sm text-muted">{rows.length} cliente(s) registrados</p>
      </div>

      <form className="flex items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por correo..."
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover"
        >
          Buscar
        </button>
        {q && (
          <a href="/admin" className="text-xs text-muted hover:text-foreground">
            Limpiar
          </a>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">IP de registro</th>
              <th className="px-5 py-3 font-medium">Creado</th>
              <th className="px-5 py-3 font-medium">Renovación</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
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
                <td className="px-5 py-3">
                  <p className="text-muted">{r.signupIp ?? "—"}</p>
                  {r.sharedIp && (
                    <span
                      title="Otro workspace se registró desde esta misma IP"
                      className="mt-1 inline-block w-fit rounded-full border border-warning px-2 py-0.5 text-[10px] text-warning"
                    >
                      Posible multicuenta
                    </span>
                  )}
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
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-muted">
                  {query ? "Sin resultados para esa búsqueda." : "Sin clientes registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
