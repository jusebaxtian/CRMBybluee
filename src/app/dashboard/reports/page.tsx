import { redirect } from "next/navigation";
import { Users, UserPlus, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { bogotaDayRange } from "@/lib/reports/day";

export default async function ReportsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "reports");

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    redirect("/dashboard");
  }

  const { ymd, startIso, endIso } = bogotaDayRange();

  const [{ count: contactsCount }, { count: todayCount }] = workspaceId
    ? await Promise.all([
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .gte("created_at", startIso)
          .lte("created_at", endIso),
      ])
    : [{ count: 0 }, { count: 0 }];

  const todayLabel = new Date(`${ymd}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-foreground">Reportes</h1>
      <p className="mt-1 text-sm text-muted">
        Exporta la información de tu workspace a Excel para control y respaldo.
      </p>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <UserPlus size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Personas que llegaron hoy</p>
              <p className="text-xs text-muted">
                {todayCount ?? 0} persona{todayCount === 1 ? "" : "s"} · {todayLabel} · hora de llegada, teléfono/usuario, etiquetas y notas
              </p>
            </div>
          </div>
          <a
            href="/api/reports/daily"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Download size={16} />
            Exportar
          </a>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Users size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Contactos</p>
              <p className="text-xs text-muted">
                {contactsCount ?? 0} contacto{contactsCount === 1 ? "" : "s"} · nombre, teléfono/usuario, etiquetas y notas
              </p>
            </div>
          </div>
          <a
            href="/api/reports/contacts"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Download size={16} />
            Exportar
          </a>
        </div>
      </div>
    </div>
  );
}
