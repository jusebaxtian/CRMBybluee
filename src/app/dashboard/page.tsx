import { redirect } from "next/navigation";
import { CalendarClock, Package, ShieldCheck, MessageSquareOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspaces(name, status, trial_ends_at, plans(name))")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as
    | { name: string; status: string; trial_ends_at: string; plans: { name: string } | null }
    | undefined;

  const trialDaysLeft = workspace
    ? Math.max(
        0,
        Math.floor(
          (new Date(workspace.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  const statusLabel: Record<string, string> = {
    trialing: "En periodo de prueba",
    active: "Activo",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<ShieldCheck size={20} />}
          label="Estado de la cuenta"
          value={workspace ? statusLabel[workspace.status] ?? workspace.status : "—"}
        />
        <StatCard
          icon={<Package size={20} />}
          label="Plan actual"
          value={workspace?.plans?.name ?? "—"}
        />
        <StatCard
          icon={<CalendarClock size={20} />}
          label="Días de prueba restantes"
          value={trialDaysLeft !== null ? `${trialDaysLeft} día(s)` : "—"}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
          <MessageSquareOff size={22} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Aún no has conectado WhatsApp
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Conecta tu número de WhatsApp Business para empezar a ver tus
          conversaciones, contactos y campañas aquí.
        </p>
        <button
          type="button"
          disabled
          className="mt-5 rounded-lg bg-primary/50 px-4 py-2 text-sm font-medium text-white/70"
          title="Disponible próximamente"
        >
          Conectar WhatsApp (próximamente)
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
