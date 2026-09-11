"use client";

import { useState, useTransition } from "react";
import { Lock, Send } from "lucide-react";
import { sendTemplateToConversation } from "@/app/actions/whatsapp";

type Template = { id: string; meta_template_name: string; language: string; body_text: string | null };

export function TemplateGatePicker({
  conversationId,
  templates,
}: {
  conversationId: string;
  templates: Template[];
}) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected = templates.find((t) => t.id === selectedId);

  function handleSend() {
    if (!selectedId) return;
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await sendTemplateToConversation({ conversationId, templateId: selectedId });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      // RealtimeRefresh picks up the sent message automatically.
    });
  }

  return (
    <div className="w-full min-w-0 border-t border-border bg-surface p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-2 text-warning">
        <Lock size={14} />
        <p className="text-xs font-medium">
          Han pasado más de 24h desde el último mensaje del cliente. Solo puedes reabrir la
          conversación enviando una plantilla aprobada.
        </p>
      </div>

      {templates.length === 0 ? (
        <p className="text-xs text-muted">
          No tienes plantillas aprobadas. Créalas en Campañas → Plantillas.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.meta_template_name} ({t.language})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSend}
            disabled={pending}
            className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <Send size={14} />
            {pending ? "Enviando..." : "Enviar plantilla"}
          </button>
        </div>
      )}

      {selected?.body_text && (
        <p className="mt-2 rounded-md border border-border bg-background p-2 text-xs text-muted">
          {selected.body_text}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-success">Plantilla enviada.</p>}
    </div>
  );
}
