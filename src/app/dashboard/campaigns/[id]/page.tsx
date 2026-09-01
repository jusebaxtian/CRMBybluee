import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Clock, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SendCampaignButton } from "@/components/send-campaign-button";
import { DeleteCampaignButton } from "@/components/delete-campaign-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { CampaignRecipientsTable } from "@/components/campaign-recipients-table";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Falló",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "campaigns");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, status, send_type, message_body, media_url, scheduled_at, templates(meta_template_name)")
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();

  if (!campaign) notFound();

  const template = campaign.templates as unknown as { meta_template_name: string } | null;

  // PostgREST hard-caps any single response at 1000 rows — a plain
  // .select() undercounted "X contactos en total" (and the table below)
  // for any campaign past that. Page through with .range() until a batch
  // comes back short, same fix as the send loop itself.
  type RecipientListRow = {
    id: string;
    status: string;
    error_message: string | null;
    contacts: { name: string | null; wa_id: string };
  };
  const recipients: RecipientListRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: batch } = await supabase
      .from("campaign_recipients")
      .select("id, status, error_message, contacts(name, wa_id)")
      .eq("campaign_id", id)
      .range(offset, offset + 999);
    if (!batch || batch.length === 0) break;
    recipients.push(...(batch as unknown as RecipientListRow[]));
    if (batch.length < 1000) break;
  }

  const isScheduled = campaign.status === "draft" && !!campaign.scheduled_at;

  return (
    <div className="flex flex-col gap-6">
      {campaign.status === "sending" && (
        <RealtimeRefresh
          table="campaign_recipients"
          filter={`campaign_id=eq.${campaign.id}`}
          channelName={`campaign-recipients-${campaign.id}`}
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/campaigns" className="text-muted hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{campaign.name}</h1>
            <p className="text-xs text-muted">
              {campaign.send_type === "free_text"
                ? `Mensaje libre${campaign.message_body ? `: "${campaign.message_body.slice(0, 60)}${campaign.message_body.length > 60 ? "..." : ""}"` : ""}${campaign.media_url ? " (con adjunto)" : ""}`
                : `Plantilla: ${template?.meta_template_name ?? "—"}`}{" "}
              · {isScheduled ? "Programada" : statusLabel[campaign.status]}
            </p>
          </div>
        </div>
        {campaign.status === "draft" && (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/dashboard/campaigns/${campaign.id}/edit`}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
            >
              <Pencil size={13} />
              Editar
            </Link>
            <DeleteCampaignButton campaignId={campaign.id} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <Users size={15} className="shrink-0 text-primary" />
          <span className="text-foreground">
            {recipients?.length ?? 0} contacto{(recipients?.length ?? 0) === 1 ? "" : "s"} en total
          </span>
        </div>
        {isScheduled && campaign.scheduled_at && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            <Clock size={15} className="shrink-0" />
            Se enviará el{" "}
            {new Date(campaign.scheduled_at).toLocaleString("es-CO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      {campaign.status === "draft" && <SendCampaignButton campaignId={campaign.id} />}

      <CampaignRecipientsTable recipients={recipients} />
    </div>
  );
}
