import { redirect } from "next/navigation";
import { Users, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId, getWorkspaceRole } from "@/lib/workspace";

export default async function ReportsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  const role = await getWorkspaceRole(supabase, workspaceId);
  if (role !== "owner" && role !== "admin") {
    redirect("/dashboard");
  }

  const { count: contactsCount } = workspaceId
    ? await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
    : { count: 0 };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-foreground">Reportes</h1>
      <p className="mt-1 text-sm text-muted">
        Exporta la información de tu workspace a Excel para control y respaldo.
      </p>

      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
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
  );
}
