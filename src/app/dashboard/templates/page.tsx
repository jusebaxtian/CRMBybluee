import { FileText, MousePointerClick } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SyncTemplatesButton } from "@/components/sync-templates-button";
import { CreateTemplateForm } from "@/components/create-template-form";
import { getWorkspaceId } from "@/lib/workspace";
import { requireModule, getEnabledModuleKeys } from "@/lib/entitlements";
import { CampaignsTabs } from "@/components/campaigns-tabs";
import { DeleteTemplateButton } from "@/components/delete-template-button";
import { TemplatePreview } from "@/components/template-preview";
import { TemplateHeaderMediaUpload } from "@/components/template-header-media-upload";

const statusLabel: Record<string, string> = {
  APPROVED: "Aprobada",
  PENDING: "Pendiente",
  REJECTED: "Rechazada",
  DELETED: "Eliminada",
};
const statusColor: Record<string, string> = {
  APPROVED: "text-success border-success bg-success/10",
  PENDING: "text-warning border-warning bg-warning/10",
  REJECTED: "text-red-400 border-red-400 bg-red-400/10",
  DELETED: "text-muted border-border line-through",
};
const headerFormatLabel: Record<string, string> = {
  TEXT: "Encabezado de texto",
  IMAGE: "Encabezado con imagen",
  VIDEO: "Encabezado con video",
  DOCUMENT: "Encabezado con documento",
};

export default async function TemplatesPage() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  await requireModule(supabase, workspaceId, "templates");
  const enabledModules = await getEnabledModuleKeys(supabase, workspaceId);

  const { data: templates } = await supabase
    .from("templates")
    .select(
      "id, meta_template_name, language, category, status, body_text, variable_count, header_format, header_text, header_media_url, buttons"
    )
    .eq("workspace_id", workspaceId ?? "")
    // Solo se muestran/usan plantillas creadas desde el formulario del CRM —
    // una creada directo en Meta Business Manager y traída por sincronizar
    // queda oculta hasta que se recree aquí. Ver migración 0075.
    .eq("created_via", "crm")
    // Eliminadas quedan como fila DELETED (no se pueden borrar del todo si
    // una campaña pasada las referencia — ver deleteTemplate()), pero no
    // deben mostrarse en ningún listado, ni siquiera tachadas aquí.
    .neq("status", "DELETED")
    // Más reciente creada primero.
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <CampaignsTabs enabledModules={enabledModules} />

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Crear nueva plantilla</h2>
        <CreateTemplateForm />
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
        Para poder usar una plantilla en campañas o automatizaciones, debe crearse desde este
        formulario. Las plantillas creadas directamente en Meta Business Manager no se muestran
        ni se pueden usar aquí — créala arriba para que quede disponible.
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <SyncTemplatesButton />
        <p className="mt-2 text-xs text-muted">
          Sincroniza para traer el estado más reciente de aprobación de las plantillas creadas
          desde aquí (no trae plantillas creadas directo en Meta Business Manager).
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const headerFormat = t.header_format as "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
            const buttons = t.buttons as { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
            return (
              <div key={t.id} className="flex flex-col rounded-xl border border-border bg-surface p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{t.meta_template_name}</p>
                    <p className="text-xs text-muted">
                      {t.language} · {t.category ?? "—"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      statusColor[t.status] ?? "text-muted border-border"
                    }`}
                  >
                    {statusLabel[t.status] ?? t.status}
                  </span>
                </div>

                <TemplatePreview
                  headerFormat={headerFormat}
                  headerText={t.header_text}
                  headerMediaUrl={t.header_media_url}
                  bodyText={t.body_text}
                  buttons={buttons}
                />

                {headerFormat && headerFormat !== "TEXT" && !t.header_media_url && (
                  <div className="mt-3">
                    <TemplateHeaderMediaUpload templateId={t.id} headerFormat={headerFormat} />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {headerFormat && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                      {headerFormatLabel[headerFormat] ?? headerFormat}
                    </span>
                  )}
                  {t.variable_count > 0 && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                      {t.variable_count} variable{t.variable_count > 1 ? "s" : ""}
                    </span>
                  )}
                  {buttons && buttons.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                      <MousePointerClick size={11} />
                      {buttons.length} botón{buttons.length > 1 ? "es" : ""}
                    </span>
                  )}
                </div>

                {t.status !== "DELETED" && (
                  <div className="mt-3 border-t border-border pt-3">
                    <DeleteTemplateButton templateId={t.id} templateName={t.meta_template_name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
