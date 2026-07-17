import Link from "next/link";
import { Zap, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AutomationRowActions } from "@/components/automation-row-actions";

export default async function AutomationsPage() {
  const supabase = await createClient();

  const { data: automations } = await supabase
    .from("automations")
    .select("id, name, trigger_type, trigger_keyword, is_active, tags(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Link
          href="/dashboard/automations/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Nueva automatización
        </Link>
      </div>

      {!automations || automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <Zap size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Todavía no tienes automatizaciones
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea flujos que respondan solos cuando etiquetes un contacto o llegue un mensaje
            con cierta palabra clave.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {automations.map((a) => {
            const tag = a.tags as unknown as { name: string } | null;
            return (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-border px-5 py-4 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted">
                    {a.trigger_type === "tag_added"
                      ? `Se activa al asignar la etiqueta "${tag?.name ?? "—"}"`
                      : `Se activa con la palabra clave "${a.trigger_keyword}"`}
                  </p>
                </div>
                <AutomationRowActions automationId={a.id} isActive={a.is_active} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
