import { redirect } from "next/navigation";
import {
  CalendarClock,
  Crown,
  ShieldCheck,
  MessageSquareOff,
  Lock,
  BadgeCheck,
  Gauge,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
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
        .select("name, status, trial_ends_at, plans(name, price_cents, currency, billing_cycle)")
        .eq("id", workspaceId)
        .maybeSingle()
    : { data: null };

  const workspace = workspaceRow as unknown as
    | {
        name: string;
        status: string;
        trial_ends_at: string;
        plans: {
          name: string;
          price_cents: number;
          currency: string;
          billing_cycle: string;
        } | null;
      }
    | null;

  const { data: subscription } = workspaceId
    ? await supabase
        .from("subscriptions")
        .select("current_period_end")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const isTrialing = workspace?.status === "trialing";
  const periodEnd = isTrialing ? workspace?.trial_ends_at : subscription?.current_period_end;

  const daysLeft = periodEnd
    ? Math.max(
        0,
        Math.ceil((new Date(periodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : null;

  const periodTotalDays = isTrialing ? 7 : 30;
  const daysProgressPct =
    daysLeft !== null ? Math.min(100, Math.max(0, (daysLeft / periodTotalDays) * 100)) : 0;

  const statusLabel: Record<string, string> = {
    trialing: "En periodo de prueba",
    active: "Activo",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
  };

  const statusColor: Record<string, string> = {
    trialing: "text-warning",
    active: "text-success",
    past_due: "text-red-400",
    canceled: "text-muted",
  };

  const statusIconBg: Record<string, string> = {
    trialing: "bg-warning/15 text-warning",
    active: "bg-success/15 text-success",
    past_due: "bg-red-400/15 text-red-400",
    canceled: "bg-surface-hover text-muted",
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

  const messagingLimitLabel: Record<string, string> = {
    TIER_50: "50 conversaciones/día",
    TIER_250: "250 conversaciones/día",
    TIER_1K: "1.000 conversaciones/día",
    TIER_10K: "10.000 conversaciones/día",
    TIER_100K: "100.000 conversaciones/día",
    UNLIMITED: "Sin límite",
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
        {/* Estado de la cuenta */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted">Estado de la cuenta</p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  workspace ? statusColor[workspace.status] ?? "text-foreground" : "text-foreground"
                }`}
              >
                {workspace ? statusLabel[workspace.status] ?? workspace.status : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {whatsappAccount ? "WhatsApp API Oficial" : workspace?.plans?.name ?? "—"}
              </p>
            </div>
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                workspace ? statusIconBg[workspace.status] ?? statusIconBg.canceled : statusIconBg.canceled
              }`}
            >
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                whatsappAccount ? "bg-success" : "bg-muted"
              }`}
            />
            {whatsappAccount ? "Todo funcionando correctamente" : "WhatsApp no conectado"}
          </div>
        </div>

        {/* Plan actual */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted">Plan actual</p>
              <p className="mt-1 text-2xl font-semibold text-blue-400">
                {workspace?.plans?.name ?? "—"}
              </p>
              {workspace?.plans && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span>
                    ${(workspace.plans.price_cents / 100).toLocaleString("es-CO")} /{" "}
                    {workspace.plans.billing_cycle === "yearly" ? "año" : "mes"}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground">
                    {workspace.plans.billing_cycle === "yearly" ? "Anual" : "Mensual"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/15 text-blue-400">
              <Crown size={20} />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            {subscription?.current_period_end
              ? `Próximo pago: ${new Date(subscription.current_period_end).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`
              : "Sin suscripción activa"}
          </p>
        </div>

        {/* Días restantes */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted">
                {isTrialing ? "Días restantes del período de prueba" : "Días para tu próxima renovación"}
              </p>
              <p className="mt-1 text-2xl font-semibold text-purple-400">
                {daysLeft !== null ? `${daysLeft} día${daysLeft === 1 ? "" : "s"}` : "—"}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-400/15 text-purple-400">
              <CalendarClock size={20} />
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-purple-400"
              style={{ width: `${daysProgressPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {periodEnd
              ? `${isTrialing ? "Tu prueba termina el" : "Tu plan se renueva el"} ${new Date(periodEnd).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="mx-auto flex aspect-[9/16] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <p className="px-3 text-center text-xs text-muted">Sin banner</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 text-center lg:text-left">
          {whatsappAccount ? (
            <>
              <div className="flex flex-col items-center gap-3 lg:flex-row">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <WhatsAppIcon size={22} />
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 lg:justify-start">
                    <h2 className="text-lg font-semibold text-foreground">WhatsApp conectado</h2>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
                      WhatsApp API Cloud
                    </span>
                  </div>
                  <p className="text-sm text-muted">{whatsappAccount.display_phone_number}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
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
                {phoneStatus?.messaging_limit_tier && (
                  <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
                    Límite: {messagingLimitLabel[phoneStatus.messaging_limit_tier] ?? phoneStatus.messaging_limit_tier}
                  </span>
                )}
              </div>
              {phoneStatus?.messaging_limit_tier && (
                <p className="mt-2 text-[11px] text-muted">
                  El límite de mensajes diarios lo define Meta según la calidad y antigüedad de tu número.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted lg:mx-0">
                <MessageSquareOff size={22} />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Aún no has conectado WhatsApp
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted lg:mx-0">
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
