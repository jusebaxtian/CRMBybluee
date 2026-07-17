import { createClient } from "@/lib/supabase/server";
import { CreateNotificationForm } from "@/components/create-notification-form";

export default async function AdminNotificationsPage() {
  const supabase = await createClient();

  const { data: workspaces } = await supabase.from("workspaces").select("id, name").order("name");
  const { data: plans } = await supabase.from("plans").select("id, name").order("name");
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, body, scope, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Nueva notificación</h2>
        <CreateNotificationForm workspaces={workspaces ?? []} plans={plans ?? []} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {(notifications ?? []).map((n) => (
          <div key={n.id} className="border-b border-border px-5 py-4 last:border-b-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{n.title}</p>
              <span className="text-xs text-muted">
                {new Date(n.created_at).toLocaleString("es-CO")}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{n.body}</p>
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
