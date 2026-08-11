import { createClient } from "@/lib/supabase/server";
import { CreateNotificationForm } from "@/components/create-notification-form";
import { DeleteNotificationButton } from "@/components/delete-notification-button";

const scopeLabel: Record<string, string> = {
  all: "Todos",
  workspace: "Workspace específico",
  plan: "Plan específico",
  status: "Estado de cuenta",
};

const statusLabel: Record<string, string> = {
  trialing: "En prueba",
  active: "Activos",
  past_due: "Sin pago",
  canceled: "Cancelados",
};

export default async function AdminNotificationsPage() {
  const supabase = await createClient();

  const { data: workspaces } = await supabase.from("workspaces").select("id, name").order("name");
  const { data: plans } = await supabase.from("plans").select("id, name").order("name");
  const { data: notifications } = await supabase
    .from("notifications")
    .select(
      "id, title, body, scope, target_status, starts_at, ends_at, cta_label, cta_url, created_at"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Nueva notificación</h2>
        <CreateNotificationForm workspaces={workspaces ?? []} plans={plans ?? []} />
      </div>

      <p className="text-xs text-muted">
        Las notificaciones se eliminan automáticamente 20 días después de creadas.
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {(notifications ?? []).map((n) => (
          <div key={n.id} className="border-b border-border px-5 py-4 last:border-b-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{n.title}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  {new Date(n.created_at).toLocaleString("es-CO")}
                </span>
                <DeleteNotificationButton notificationId={n.id} />
              </div>
            </div>
            <p className="mt-1 text-sm text-muted">{n.body}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-border px-2 py-0.5">
                {scopeLabel[n.scope] ?? n.scope}
                {n.scope === "status" && n.target_status
                  ? `: ${statusLabel[n.target_status] ?? n.target_status}`
                  : ""}
              </span>
              <span>Desde: {new Date(n.starts_at).toLocaleDateString("es-CO")}</span>
              <span>
                Hasta: {n.ends_at ? new Date(n.ends_at).toLocaleDateString("es-CO") : "Sin límite"}
              </span>
              {n.cta_label && n.cta_url && (
                <span className="rounded-full border border-primary px-2 py-0.5 text-primary">
                  Botón: {n.cta_label}
                </span>
              )}
            </div>
          </div>
        ))}
        {(!notifications || notifications.length === 0) && (
          <p className="p-6 text-center text-sm text-muted">
            No has enviado notificaciones todavía.
          </p>
        )}
      </div>
    </div>
  );
}
