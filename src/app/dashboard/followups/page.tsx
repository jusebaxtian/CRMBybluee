import Link from "next/link";
import { History, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AutomationRowActions } from "@/components/automation-row-actions";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule } from "@/lib/entitlements";
import { CampaignsTabs } from "@/components/campaigns-tabs";
import { toggleFollowupSequenceActive, deleteFollowupSequence } from "@/app/actions/followups";

export default async function FollowupsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "campaigns");

  const { data: sequences } = await supabase
    .from("automations")
    .select("id, name, is_active, automation_actions(delay_seconds)")
    .eq("workspace_id", workspaceId ?? "")
    .eq("trigger_type", "no_reply")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <CampaignsTabs />

      <div className="flex justify-end">
        <Link
          href="/dashboard/followups/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Nuevo seguimiento
        </Link>
      </div>

      {!sequences || sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <History size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Todavía no tienes seguimientos
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea una secuencia que le escriba de nuevo a un contacto cuando le envías un mensaje
            y no responde — por ejemplo, a la 1 hora y de nuevo a las 2 horas.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {sequences.map((s) => {
            const steps = ((s.automation_actions ?? []) as { delay_seconds: number }[])
              .slice()
              .sort((a, b) => a.delay_seconds - b.delay_seconds);
            const summary = steps
              .map((st) => formatDelay(st.delay_seconds))
              .join(" · ");
            return (
              <div
                key={s.id}
                className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted">
                    {steps.length} paso{steps.length === 1 ? "" : "s"}
                    {summary && ` · ${summary}`}
                  </p>
                </div>
                <AutomationRowActions
                  automationId={s.id}
                  automationName={s.name}
                  isActive={s.is_active}
                  editHref={`/dashboard/followups/${s.id}`}
                  itemLabel="el seguimiento"
                  onToggle={toggleFollowupSequenceActive}
                  onDelete={deleteFollowupSequence}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDelay(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const hours = seconds / 3600;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
}
