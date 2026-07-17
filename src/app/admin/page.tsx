import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusColor: Record<string, string> = {
  trialing: "text-warning border-warning",
  active: "text-success border-success",
  past_due: "text-red-400 border-red-400",
  canceled: "text-muted border-border",
};

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, status, trial_ends_at, created_at, plans(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="text-sm text-muted">{workspaces?.length ?? 0} cliente(s) registrados</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Workspace</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Creado</th>
            </tr>
          </thead>
          <tbody>
            {(workspaces ?? []).map((w) => {
              const plan = w.plans as unknown as { name: string } | null;
              return (
                <tr
                  key={w.id}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-hover"
                >
                  <td className="px-5 py-3">
                    <Link href={`/admin/workspaces/${w.id}`} className="text-foreground hover:underline">
                      {w.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-foreground">{plan?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusColor[w.status] ?? ""}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Date(w.created_at).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
