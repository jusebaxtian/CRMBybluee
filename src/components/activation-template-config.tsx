"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveActivationTemplateConfig,
  syncPlatformTemplates,
  type ActivationField,
  type ActivationTemplateConfig,
} from "@/app/actions/admin-whatsapp";

type Template = {
  meta_template_name: string;
  language: string;
  status: string;
  body_text: string | null;
  variable_count: number;
};

const FIELD_LABELS: Record<ActivationField, string> = {
  plan_name: "Nombre del plan",
  activation_date: "Fecha de activación",
  expiry_date: "Fecha de vencimiento",
  username: "Usuario (nombre del cliente)",
  email: "Correo",
  fixed: "Texto fijo...",
};

export function ActivationTemplateConfigPanel({
  templates,
  initialConfig,
}: {
  templates: Template[];
  initialConfig: ActivationTemplateConfig | null;
}) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [saving, startSave] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [selectedName, setSelectedName] = useState(initialConfig?.templateName ?? "");
  const selected = templates.find(
    (t) => `${t.meta_template_name}__${t.language}` === selectedName
  );

  const [variables, setVariables] = useState<ActivationTemplateConfig["variables"]>(
    initialConfig?.variables ?? []
  );

  function handleSelectTemplate(value: string) {
    setSelectedName(value);
    setSaveSuccess(false);
    const t = templates.find((tpl) => `${tpl.meta_template_name}__${tpl.language}` === value);
    const count = t?.variable_count ?? 0;
    setVariables(
      Array.from({ length: count }, (_, i) => variables[i] ?? { field: "plan_name" as ActivationField })
    );
  }

  function handleSync() {
    setSyncMessage(null);
    startSync(async () => {
      const result = await syncPlatformTemplates();
      if (result?.error) {
        setSyncMessage(result.error);
        return;
      }
      setSyncMessage(`${result?.count ?? 0} plantillas sincronizadas.`);
      router.refresh();
    });
  }

  function handleSave() {
    if (!selected) {
      setSaveError("Selecciona una plantilla.");
      return;
    }
    setSaveError(null);
    setSaveSuccess(false);
    startSave(async () => {
      const result = await saveActivationTemplateConfig({
        templateName: selected.meta_template_name,
        language: selected.language,
        variables,
      });
      if (result?.error) {
        setSaveError(result.error);
        return;
      }
      setSaveSuccess(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Plantilla de notificación de activación</p>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          {syncing ? "Sincronizando..." : "Sincronizar plantillas"}
        </button>
      </div>
      {syncMessage && <p className="mb-3 text-xs text-muted">{syncMessage}</p>}

      {templates.length === 0 ? (
        <p className="text-sm text-muted">
          Aún no hay plantillas sincronizadas. Conecta el WhatsApp de administración y sincroniza.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Plantilla</label>
            <select
              value={selectedName}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">Selecciona una plantilla...</option>
              {templates.map((t) => (
                <option
                  key={`${t.meta_template_name}__${t.language}`}
                  value={`${t.meta_template_name}__${t.language}`}
                >
                  {t.meta_template_name} ({t.language}) — {t.status}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              {selected.body_text && (
                <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted">
                  {selected.body_text}
                </div>
              )}

              {selected.variable_count === 0 ? (
                <p className="text-xs text-muted">Esta plantilla no tiene variables.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {variables.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-xs text-muted">{`{{${i + 1}}}`}</span>
                      <select
                        value={v.field}
                        onChange={(e) => {
                          const field = e.target.value as ActivationField;
                          setVariables((prev) =>
                            prev.map((p, idx) => (idx === i ? { field } : p))
                          );
                        }}
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                      >
                        {Object.entries(FIELD_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {v.field === "fixed" && (
                        <input
                          type="text"
                          value={v.fixedText ?? ""}
                          onChange={(e) => {
                            const fixedText = e.target.value;
                            setVariables((prev) =>
                              prev.map((p, idx) =>
                                idx === i ? { field: "fixed", fixedText } : p
                              )
                            );
                          }}
                          placeholder="Texto..."
                          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar configuración"}
                </button>
                {saveError && <p className="mt-2 text-xs text-red-400">{saveError}</p>}
                {saveSuccess && <p className="mt-2 text-xs text-success">Configuración guardada.</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
