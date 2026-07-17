import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SyncTemplatesButton } from "@/components/sync-templates-button";
import { CreateTemplateForm } from "@/components/create-template-form";

const statusColor: Record<string, string> = {
  APPROVED: "text-success border-success",
  PENDING: "text-warning border-warning",
  REJECTED: "text-red-400 border-red-400",
};

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("id, meta_template_name, language, category, status, body_text")
    .order("meta_template_name");

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Crear nueva plantilla</h2>
        <CreateTemplateForm />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <SyncTemplatesButton />
        <p className="mt-2 text-xs text-muted">
          Sincroniza para traer el estado más reciente de aprobación de Meta (o plantillas
          creadas antes desde Meta Business Manager).
        </p>
      </div>

      {!templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
            <FileText size={22} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Todavía no tienes plantillas
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted">
            Crea tu primera plantilla arriba, o sincroniza las que ya existan en Meta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-foreground">{t.meta_template_name}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    statusColor[t.status] ?? "text-muted border-border"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <p className="text-xs text-muted">
                {t.language} · {t.category ?? "—"}
              </p>
              {t.body_text && (
                <p className="mt-3 text-sm text-foreground">{t.body_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
