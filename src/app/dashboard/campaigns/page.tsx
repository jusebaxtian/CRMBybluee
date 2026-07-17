import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando...",
  completed: "Completada",
  failed: "Falló",
};

export default async function CampaignsPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, templates(meta_template_name)")
    .eq("workspace_id", workspaceId ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
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
            return (
              <Link
                key={c.id}
                href={`/dashboard/campaigns/${c.id}`}
                className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0 hover:bg-surface-hover"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted">
                    Plantilla: {template?.meta_template_name ?? "—"}
                  </p>
                </div>
                <span className="text-xs text-muted">{statusLabel[c.status] ?? c.status}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
