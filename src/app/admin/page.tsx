import { Users, CreditCard, Clock, AlertTriangle, Plug, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkspaceRowActions } from "@/components/workspace-row-actions";

function daysSince(dateStr: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  );
}

const statusColor: Record<string, string> = {
  trialing: "text-warning border-warning",
  active: "text-success border-success",
  past_due: "text-red-400 border-red-400",
  canceled: "text-muted border-border",
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const { q, from, to } = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, phone, status, access_disabled, created_at, trial_ends_at, signup_ip, plans(name)")
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
      let lastSignInAt: string | null = null;
      if (owner?.user_id) {
        const { data } = await admin.auth.admin.getUserById(owner.user_id);
        email = data.user?.email ?? "—";
        lastSignInAt = data.user?.last_sign_in_at ?? null;
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
        phone: w.phone ?? null,
        signupIp: w.signup_ip,
        sharedIp: w.signup_ip ? (ipCounts.get(w.signup_ip) ?? 0) > 1 : false,
        lastSignInAt,
      };
    })
  );

  const query = (q ?? "").trim().toLowerCase();
  let filteredRows = query
    ? rows.filter((r) => r.email.toLowerCase().includes(query))
    : rows;

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(`${to}T23:59:59`) : null;
  if (fromDate) filteredRows = filteredRows.filter((r) => new Date(r.createdAt) >= fromDate);
  if (toDate) filteredRows = filteredRows.filter((r) => new Date(r.createdAt) <= toDate);

  // KPI cards always reflect the current calendar month, independent of the
  // date/email filters above (which only affect the table below).
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthLabel = now.toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  const monthRows = rows.filter((r) => r.createdAt >= monthStart);
  const totalClients = monthRows.length;
  const activePaidClients = monthRows.filter((r) => r.status === "active").length;
  const trialingClients = monthRows.filter((r) => r.status === "trialing").length;
  const unpaidClients = monthRows.filter((r) => r.status === "past_due").length;

  const [{ count: connectedWhatsappCount }, { count: sentMessagesCount }] = await Promise.all([
    supabase
      .from("whatsapp_accounts")
      .select("id", { count: "exact", head: true })
      .gte("connected_at", monthStart),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "out")
      .gte("created_at", monthStart),
  ]);

  const kpis = [
    { label: "Total clientes", value: totalClients, icon: Users, color: "text-blue-400 bg-blue-400/15" },
    { label: "Clientes activos con pago", value: activePaidClients, icon: CreditCard, color: "text-success bg-success/15" },
    { label: "Clientes en periodo de prueba", value: trialingClients, icon: Clock, color: "text-warning bg-warning/15" },
    { label: "Clientes sin pago", value: unpaidClients, icon: AlertTriangle, color: "text-red-400 bg-red-400/15" },
    { label: "APIs de WhatsApp conectadas", value: connectedWhatsappCount ?? 0, icon: Plug, color: "text-purple-400 bg-purple-400/15" },
    { label: "Mensajes enviados", value: sentMessagesCount ?? 0, icon: Send, color: "text-primary bg-primary/15" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-sm text-muted">{rows.length} cliente(s) registrados</p>
      </div>

      <p className="-mb-2 text-xs text-muted">
        Tarjetas del mes actual ({monthLabel})
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-surface p-4">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
              <Icon size={17} />
            </div>
            <p className="text-2xl font-semibold text-foreground">{value.toLocaleString("es-CO")}</p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por correo..."
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span>Creado entre</span>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <span>y</span>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover"
        >
          Filtrar
        </button>
        {(q || from || to) && (
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
              <th className="px-5 py-3 font-medium">Teléfono</th>
              <th className="px-5 py-3 font-medium">Plan / Estado</th>
              <th className="px-5 py-3 font-medium">IP de registro</th>
              <th className="px-5 py-3 font-medium">Última conexión</th>
              <th className="px-5 py-3 font-medium">Creado / Renovación</th>
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
                <td className="px-5 py-3 text-foreground">{r.phone ?? "—"}</td>
                <td className="px-5 py-3">
                  <p className="text-foreground">{r.plan}</p>
                  <div className="mt-1 flex flex-col gap-1">
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
                <td className="px-5 py-3">
                  {r.lastSignInAt ? (
                    <>
                      <p className="text-muted">
                        {new Date(r.lastSignInAt).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted">
                        Hace {daysSince(r.lastSignInAt)} día(s)
                      </p>
                    </>
                  ) : (
                    <p className="text-muted">—</p>
                  )}
                </td>
                <td className="px-5 py-3 text-muted">
                  <p>{new Date(r.createdAt).toLocaleDateString("es-CO")}</p>
                  <p className="mt-1 text-xs">
                    {r.renewalDate
                      ? `Renueva: ${new Date(r.renewalDate).toLocaleDateString("es-CO")}`
                      : "Sin renovación"}
                  </p>
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
