import Link from "next/link";
import { Megaphone, Phone, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { StatBadge, StatusBadge } from "@/components/campaigns/stat-badge";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Falló",
};

const statusColor: Record<string, "muted" | "accent" | "success" | "danger"> = {
  draft: "muted",
  sending: "accent",
  completed: "success",
  failed: "danger",
};

const dateFormat: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

// Qué fecha tiene sentido mostrar depende del estado: created_at (cuándo se
// creó el borrador) no le dice nada al usuario sobre una campaña ya enviada,
// que es lo que se quiere ver en la lista.
function campaignDateLine(c: {
  status: string;
  created_at: string;
  scheduled_at: string | null;
  started_at: string | null;
}): string {
  if (c.status === "draft" && c.scheduled_at) {
    return `Se enviará el ${new Date(c.scheduled_at).toLocaleString("es-CO", dateFormat)}`;
  }

  if (c.started_at) {
    const verbo = c.status === "sending" ? "Envío iniciado el" : "Enviada el";
    return `${verbo} ${new Date(c.started_at).toLocaleString("es-CO", dateFormat)}`;
  }

  // Borrador sin programar, o una campaña vieja anterior a started_at cuyos
  // destinatarios nunca llegaron a enviarse.
  return `Creada el ${new Date(c.created_at).toLocaleString("es-CO", dateFormat)}`;
}

export default async function CampaignsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "campaigns");

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      "id, name, status, send_type, created_at, scheduled_at, started_at, whatsapp_account_id, templates(meta_template_name)"
    )
    .eq("workspace_id", workspaceId ?? "")
    .order("created_at", { ascending: false });

  // Por que linea salio cada envio. Las campañas sin linea elegida (las de
  // antes de tener varios numeros) salieron por la misma que usa el envio en
  // ese caso: la primera conectada que no este congelada.
  const { data: lineas } = await supabase
    .from("whatsapp_accounts")
    .select("id, label, display_phone_number, status, connected_at")
    .eq("workspace_id", workspaceId ?? "")
    .order("connected_at", { ascending: true });
  const lineasPorId = new Map((lineas ?? []).map((l) => [l.id as string, l]));
  const lineaPorDefecto = (lineas ?? []).find((l) => l.status !== "frozen") ?? null;
  const lineaDeCampaña = (whatsappAccountId: string | null) => {
    const elegida = whatsappAccountId ? lineasPorId.get(whatsappAccountId) : null;
    const l = elegida ?? lineaPorDefecto;
    if (!l) return null;
    const nombre = l.label ? `${l.display_phone_number} · ${l.label}` : l.display_phone_number;
    // Sin linea guardada el envio uso la principal, pero eso es una deduccion,
    // no un dato de la campaña: se dice tal cual para no afirmar de mas.
    return elegida ? nombre : `${nombre} (línea principal)`;
  };

  // Aggregated in SQL (see campaign_recipient_counts) rather than fetching
  // campaign_recipients directly — a campaign can have thousands of rows,
  // which would hit PostgREST's 1000-row response cap.
  const { data: counts } = await supabase.rpc("campaign_recipient_counts", {
    p_workspace_id: workspaceId ?? "",
  });
  const countsByCampaign = new Map(
    (
      (counts ?? []) as {
        campaign_id: string;
        sent_count: number;
        failed_count: number;
        pending_count: number;
      }[]
    ).map((c) => [
      c.campaign_id,
      { sent: c.sent_count, failed: c.failed_count, pending: c.pending_count },
    ])
  );

  // Motivo de fallo predominante, para el tooltip de "Falló"/"fallidos".
  // Tambien se agrega en SQL (ver campaign_failure_reasons) por el limite de
  // 1000 filas de PostgREST.
  const { data: motivos } = await supabase.rpc("campaign_failure_reasons", {
    p_workspace_id: workspaceId ?? "",
  });
  const motivosPorCampaña = new Map(
    (
      (motivos ?? []) as {
        campaign_id: string;
        reason: string;
        reason_count: number;
        failed_count: number;
        distinct_reasons: number;
      }[]
    ).map((m) => [m.campaign_id, m])
  );
  const motivoDeFallo = (campaignId: string): string | undefined => {
    const m = motivosPorCampaña.get(campaignId);
    if (!m) return undefined;
    const cabeza = `${m.reason_count} de ${m.failed_count} fallidos: ${m.reason}`;
    // Cuando hay mas de un motivo se dice, para que no parezca que ese unico
    // texto explica todos los fallos de la campaña.
    const otros = m.distinct_reasons - 1;
    return otros > 0
      ? `${cabeza}

Y ${otros} motivo${otros === 1 ? "" : "s"} más. Abre la campaña para verlos uno por uno.`
      : cabeza;
  };

  return (
    <div className="flex flex-col gap-6">

      <div className="flex justify-end">
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-[10px] text-[12.5px] font-bold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Nueva campaña
        </Link>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[13px] border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <Megaphone size={22} />
          </div>
          <h2 className="font-dash-ui text-[15px] font-semibold text-foreground">
            Todavía no tienes campañas
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea tu primera campaña para enviar mensajes masivos con una plantilla aprobada.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[13px] border border-border bg-surface">
          {campaigns.map((c) => {
            const template = c.templates as unknown as { meta_template_name: string } | null;
            const count = countsByCampaign.get(c.id);
            const hasRecipients = count && count.sent + count.failed + count.pending > 0;
            return (
              <Link
                key={c.id}
                href={`/dashboard/campaigns/${c.id}`}
                className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.send_type === "free_text"
                      ? "Mensaje libre"
                      : `Plantilla: ${template?.meta_template_name ?? "—"}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">{campaignDateLine(c)}</p>
                  {lineaDeCampaña(c.whatsapp_account_id) && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                      <Phone size={10} className="shrink-0" />
                      {lineaDeCampaña(c.whatsapp_account_id)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {hasRecipients && (
                    <div className="flex items-center gap-2">
                      <StatBadge value={count.sent} label="enviados" color="success" />
                      {count.failed > 0 && (
                        <StatBadge
                          value={count.failed}
                          label="fallidos"
                          color="danger"
                          title={motivoDeFallo(c.id)}
                        />
                      )}
                      {count.pending > 0 && (
                        <StatBadge value={count.pending} label="pendientes" color="muted" />
                      )}
                    </div>
                  )}
                  <StatusBadge
                    label={
                      c.status === "draft" && c.scheduled_at ? "Programada" : statusLabel[c.status] ?? c.status
                    }
                    color={
                      c.status === "draft" && c.scheduled_at ? "warning" : statusColor[c.status] ?? "muted"
                    }
                    title={motivoDeFallo(c.id)}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
