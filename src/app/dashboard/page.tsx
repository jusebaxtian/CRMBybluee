import { redirect } from "next/navigation";
import {
  CalendarClock,
  Package,
  ShieldCheck,
  MessageSquareOff,
  CheckCircle2,
  Lock,
  BadgeCheck,
  Gauge,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button";
import { getWorkspaceId } from "@/lib/workspace";
import { getPhoneNumberStatus } from "@/lib/whatsapp/graph";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const locked = typeof params.locked === "string" ? params.locked : null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = await getWorkspaceId(supabase);

  const { data: workspaceRow } = workspaceId
    ? await supabase
        .from("workspaces")
        .select("name, status, trial_ends_at, plans(name)")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };

  const workspace = workspaceRow as unknown as
    | { name: string; status: string; trial_ends_at: string; plans: { name: string } | null }
    | null;

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

  const { data: whatsappAccount } = workspaceId
    ? await supabase
        .from("whatsapp_accounts")
        .select("phone_number_id, access_token, display_phone_number, status")
        .eq("workspace_id", workspaceId)
        .maybeSingle()
    : { data: null };

  let phoneStatus: Awaited<ReturnType<typeof getPhoneNumberStatus>> | null = null;
  if (whatsappAccount) {
    try {
      phoneStatus = await getPhoneNumberStatus(
        whatsappAccount.phone_number_id,
        whatsappAccount.access_token
      );
    } catch {
      phoneStatus = null;
    }
  }

  const { data: bannerSetting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "dashboard_banner_url")
    .maybeSingle();
  const bannerUrl = bannerSetting?.value ?? null;

  const qualityLabel: Record<string, string> = {
    GREEN: "Buena",
    YELLOW: "Media",
    RED: "Baja",
    UNKNOWN: "Desconocida",
  };
  const qualityColor: Record<string, string> = {
    GREEN: "text-success border-success",
    YELLOW: "text-warning border-warning",
    RED: "text-red-400 border-red-400",
    UNKNOWN: "text-muted border-border",
  };

  return (
    <div className="flex flex-col gap-6">
      {locked && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <Lock size={18} className="shrink-0 text-warning" />
          <p className="text-sm text-foreground">
            El módulo &quot;{locked}&quot; no está incluido en tu plan actual. Contacta a soporte
            para actualizar tu plan.
          </p>
        </div>
      )}
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

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:items-center">
        <div className="mx-auto flex aspect-square w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background sm:mx-0">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <p className="px-3 text-center text-xs text-muted">Sin banner</p>
          )}
        </div>

        <div className="flex-1 text-center sm:text-left">
          {whatsappAccount ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success sm:mx-0">
                <CheckCircle2 size={22} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">WhatsApp conectado</h2>
              <p className="mt-1 text-sm text-muted">{whatsappAccount.display_phone_number}</p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
                  {phoneStatus?.verified_name ?? "—"}
                </span>
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    phoneStatus?.code_verification_status === "VERIFIED"
                      ? "border-success text-success"
                      : "border-border text-muted"
                  }`}
                >
                  <BadgeCheck size={13} />
                  {phoneStatus?.code_verification_status === "VERIFIED"
                    ? "Negocio verificado"
                    : "No verificado"}
                </span>
                {phoneStatus?.quality_rating && (
                  <span
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      qualityColor[phoneStatus.quality_rating] ?? qualityColor.UNKNOWN
                    }`}
                  >
                    <Gauge size={13} />
                    Calidad: {qualityLabel[phoneStatus.quality_rating] ?? phoneStatus.quality_rating}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted sm:mx-0">
                <MessageSquareOff size={22} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Aún no has conectado WhatsApp
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted">
                Conecta tu número de WhatsApp Business para empezar a ver tus
                conversaciones, contactos y campañas aquí.
              </p>
              <ConnectWhatsAppButton />
            </>
          )}
        </div>
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
