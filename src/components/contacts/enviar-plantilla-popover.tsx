"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate, Loader2, X } from "lucide-react";
import { sendTemplateToContact } from "@/app/actions/whatsapp";
import { etiquetaLinea, plantillasParaLinea, type LineaOption } from "@/components/automations/selector-linea";

export type PlantillaOption = { id: string; meta_template_name: string; waba_id: string; body_text: string | null };

const SELECT =
  "w-full rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary";

/**
 * "Plantilla" en la fila del contacto: elige la línea (solo si hay más de
 * una) y una plantilla aprobada de esa línea, la envía y abre el chat. Un
 * contacto que nunca ha escrito solo puede recibir plantillas, por eso
 * reemplazó al cuadro de texto libre.
 */
export function EnviarPlantillaPopover({
  contactId,
  lineas,
  plantillas,
}: {
  contactId: string;
  lineas: LineaOption[];
  plantillas: PlantillaOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lineaId, setLineaId] = useState(lineas.length === 1 ? lineas[0].id : "");
  const [plantillaId, setPlantillaId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disponibles = plantillasParaLinea(plantillas, lineas, lineaId);
  const elegida = disponibles.find((p) => p.id === plantillaId) ?? null;

  function cambiarLinea(id: string) {
    setLineaId(id);
    setPlantillaId("");
  }

  async function enviar() {
    if (!plantillaId) return;
    setPending(true);
    setError(null);
    const r = await sendTemplateToContact({ contactId, templateId: plantillaId, whatsappAccountId: lineaId || null });
    setPending(false);
    if ("error" in r) {
      setError(r.error ?? "Ocurrió un error.");
      return;
    }
    setOpen(false);
    router.push(`/dashboard/inbox/${r.conversationId}`);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-hover"
      >
        <LayoutTemplate size={12} />
        Plantilla
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Enviar plantilla</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          {lineas.length === 0 ? (
            <p className="text-xs text-muted">Conecta una línea de WhatsApp para enviar plantillas.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {lineas.length > 1 && (
                <label className="text-xs font-medium text-muted">
                  ¿Desde qué línea?
                  <select value={lineaId} onChange={(e) => cambiarLinea(e.target.value)} className={`${SELECT} mt-1`}>
                    <option value="">Elige la línea…</option>
                    {lineas.map((l) => (
                      <option key={l.id} value={l.id}>
                        {etiquetaLinea(l)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-xs font-medium text-muted">
                Plantilla
                <select
                  value={plantillaId}
                  onChange={(e) => setPlantillaId(e.target.value)}
                  disabled={lineas.length > 1 && !lineaId}
                  className={`${SELECT} mt-1 disabled:opacity-50`}
                >
                  <option value="">
                    {lineas.length > 1 && !lineaId
                      ? "Primero elige la línea"
                      : disponibles.length === 0
                        ? "No hay plantillas aprobadas"
                        : "Elige la plantilla…"}
                  </option>
                  {disponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.meta_template_name}
                    </option>
                  ))}
                </select>
              </label>
              {elegida?.body_text && (
                <p className="max-h-24 overflow-y-auto whitespace-pre-line rounded-[9px] border border-border bg-background px-2 py-1.5 text-xs text-muted">
                  {elegida.body_text}
                </p>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="button"
                onClick={enviar}
                disabled={pending || !plantillaId}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {pending ? "Enviando..." : "Enviar y abrir chat"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
