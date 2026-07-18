import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SendCampaignButton } from "@/components/send-campaign-button";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Falló",
};

const recipientStatusColor: Record<string, string> = {
  pending: "text-muted border-border",
  sent: "text-primary border-primary",
  delivered: "text-success border-success",
  read: "text-success border-success",
  failed: "text-red-400 border-red-400",
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
    .select("id, name, status, templates(meta_template_name)")
    .eq("id", id)
    .eq("workspace_id", workspaceId ?? "")
    .maybeSingle();

  if (!campaign) notFound();

  const template = campaign.templates as unknown as { meta_template_name: string } | null;

  const { data: recipients } = await supabase
    .from("campaign_recipients")
    .select("id, status, error_message, contacts(name, wa_id)")
    .eq("campaign_id", id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/campaigns" className="text-muted hover:text-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{campaign.name}</h1>
          <p className="text-xs text-muted">
            Plantilla: {template?.meta_template_name ?? "—"} · {statusLabel[campaign.status]}
          </p>
        </div>
      </div>

      {campaign.status === "draft" && <SendCampaignButton campaignId={campaign.id} />}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Contacto</th>
              <th className="px-5 py-3 font-medium">Número</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(recipients ?? []).map((r) => {
              const contact = r.contacts as unknown as { name: string | null; wa_id: string };
              return (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3 text-foreground">{contact.name ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{contact.wa_id}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        recipientStatusColor[r.status]
                      }`}
                      title={r.error_message ?? undefined}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(!recipients || recipients.length === 0) && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-muted">
                  Esta campaña no tiene destinatarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
