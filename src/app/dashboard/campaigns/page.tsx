import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule, getEnabledModuleKeys } from "@/lib/entitlements";
import { CampaignsTabs } from "@/components/campaigns-tabs";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Falló",
};

export default async function CampaignsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "campaigns");
  const enabledModules = await getEnabledModuleKeys(supabase, workspaceId);

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, send_type, created_at, scheduled_at, templates(meta_template_name)")
    .eq("workspace_id", workspaceId ?? "")
    .order("created_at", { ascending: false });

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

  return (
    <div className="flex flex-col gap-6">
      <CampaignsTabs enabledModules={enabledModules} />

      <div className="flex justify-end">
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Nueva campaña
        </Link>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <Megaphone size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Todavía no tienes campañas
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea tu primera campaña para enviar mensajes masivos con una plantilla aprobada.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
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
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {hasRecipients && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-success">{count.sent} enviados</span>
                      {count.failed > 0 && <span className="text-red-400">{count.failed} fallidos</span>}
                      {count.pending > 0 && <span className="text-muted">{count.pending} pendientes</span>}
                    </div>
                  )}
                  <span className="text-xs text-muted">
                    {c.status === "draft" && c.scheduled_at ? "Programada" : statusLabel[c.status] ?? c.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
