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
import { TagStatsTable } from "@/components/tag-stats-table";
import { getWorkspaceId } from "@/lib/workspace";
import { getPhoneNumberStatus } from "@/lib/whatsapp/graph";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const locked = typeof params.locked === "string" ? params.locked : null;
  const tagsFrom = typeof params.tagsFrom === "string" ? params.tagsFrom : null;
  const tagsTo = typeof params.tagsTo === "string" ? params.tagsTo : null;
  const tagsFromIso = tagsFrom ? new Date(`${tagsFrom}T00:00:00`).toISOString() : null;
  const tagsToIso = tagsTo ? new Date(`${tagsTo}T23:59:59.999`).toISOString() : null;

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

  // A workspace can have more than one number now — the home dashboard
  // summarizes the first connected one; /dashboard/settings has the full list.
  const { data: whatsappAccount } = workspaceId
    ? await supabase
        .from("whatsapp_accounts")
        .select("phone_number_id, access_token, display_phone_number, status")
        .eq("workspace_id", workspaceId)
        .order("connected_at")
        .limit(1)
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

  // Meta's messaging limit is a rolling 24h window, not a calendar day —
  // count business-initiated conversations opened in the last 24h to match.
  const { count: conversationsOpenedCount } =
    workspaceId && whatsappAccount
      ? await supabase
          .from("conversation_opens")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .gte("opened_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      : { count: null };

  const messagingLimitValue: Record<string, number> = {
    TIER_50: 50,
    TIER_250: 250,
    TIER_1K: 1000,
    TIER_10K: 10000,
    TIER_100K: 100000,
  };
  const dailyLimit = phoneStatus?.messaging_limit_tier
    ? messagingLimitValue[phoneStatus.messaging_limit_tier]
    : undefined;
  const conversationsUsedPct =
    dailyLimit && conversationsOpenedCount !== null
      ? Math.min(100, (conversationsOpenedCount / dailyLimit) * 100)
      : null;

  let contactsCountQuery = workspaceId
    ? supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId)
    : null;
  if (contactsCountQuery && tagsFromIso) contactsCountQuery = contactsCountQuery.gte("created_at", tagsFromIso);
  if (contactsCountQuery && tagsToIso) contactsCountQuery = contactsCountQuery.lte("created_at", tagsToIso);

  const [{ data: tagsRaw }, { data: tagCounts }, { count: totalContacts }] = await Promise.all([
    workspaceId
      ? supabase.from("tags").select("id, name, color").eq("workspace_id", workspaceId).order("position")
      : Promise.resolve({ data: [] as { id: string; name: string; color: string }[] }),
    workspaceId
      ? supabase.rpc("tag_contact_counts", {
          p_workspace_id: workspaceId,
          p_created_from: tagsFromIso,
          p_created_to: tagsToIso,
        })
      : Promise.resolve({ data: [] as { tag_id: string; contact_count: number }[] }),
    contactsCountQuery ?? Promise.resolve({ count: 0 }),
  ]);

  const countByTagId = new Map(
    ((tagCounts ?? []) as { tag_id: string; contact_count: number }[]).map((r) => [
      r.tag_id,
      Number(r.contact_count),
    ])
  );
  const tagStats = (tagsRaw ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    count: countByTagId.get(t.id) ?? 0,
  }));

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
    <div className="flex flex-col gap-3">
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
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">Estado de la cuenta</p>
              <p
                className={`text-xl font-semibold leading-tight ${
                  workspace ? statusColor[workspace.status] ?? "text-foreground" : "text-foreground"
                }`}
              >
                {workspace ? statusLabel[workspace.status] ?? workspace.status : "—"}
              </p>
              <p className="text-xs text-muted">
                {whatsappAccount ? "WhatsApp API Oficial" : workspace?.plans?.name ?? "—"}
              </p>
            </div>
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                workspace ? statusIconBg[workspace.status] ?? statusIconBg.canceled : statusIconBg.canceled
              }`}
            >
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                whatsappAccount ? "bg-success" : "bg-muted"
              }`}
            />
            {whatsappAccount ? "Todo funcionando correctamente" : "WhatsApp no conectado"}
          </div>
        </div>

        {/* Plan actual */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">Plan actual</p>
              <p className="text-xl font-semibold leading-tight text-blue-400">
                {workspace?.plans?.name ?? "—"}
              </p>
              {workspace?.plans && (
                <div className="flex items-center gap-2 text-xs text-muted">
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-400/15 text-blue-400">
              <Crown size={18} />
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {subscription?.current_period_end
              ? `Próximo pago: ${new Date(subscription.current_period_end).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`
              : "Sin suscripción activa"}
          </p>
        </div>

        {/* Días restantes */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted">
                {isTrialing ? "Días restantes del período de prueba" : "Días para tu próxima renovación"}
              </p>
              <p className="text-xl font-semibold leading-tight text-purple-400">
                {daysLeft !== null ? `${daysLeft} día${daysLeft === 1 ? "" : "s"}` : "—"}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-400/15 text-purple-400">
              <CalendarClock size={18} />
            </div>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-purple-400"
              style={{ width: `${daysProgressPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
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

              {dailyLimit && conversationsOpenedCount !== null && (
                <div className="mt-4 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      Conversaciones iniciadas (últimas 24h)
                    </span>
                    <span
                      className={
                        conversationsUsedPct !== null && conversationsUsedPct >= 90
                          ? "font-semibold text-red-400"
                          : conversationsUsedPct !== null && conversationsUsedPct >= 70
                            ? "font-semibold text-warning"
                            : "font-semibold text-foreground"
                      }
                    >
                      {conversationsOpenedCount} / {dailyLimit.toLocaleString("es-CO")}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className={`h-full rounded-full ${
                        conversationsUsedPct !== null && conversationsUsedPct >= 90
                          ? "bg-red-400"
                          : conversationsUsedPct !== null && conversationsUsedPct >= 70
                            ? "bg-warning"
                            : "bg-success"
                      }`}
                      style={{ width: `${conversationsUsedPct ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    Cuenta las conversaciones que tú iniciaste (campañas, plantillas fuera de la
                    ventana de 24h) — las respuestas dentro de la ventana de atención no cuentan
                    para este límite de Meta.
                  </p>
                </div>
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

      <TagStatsTable
        tags={tagStats}
        totalContacts={totalContacts ?? 0}
        dateFrom={tagsFrom}
        dateTo={tagsTo}
      />
    </div>
  );
}
