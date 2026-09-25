"use client";

import { useState } from "react";
import { Bot, Plus } from "lucide-react";
import { AiAgentPanel } from "@/components/ai-agent/ai-agent-panel";

type FollowupStep = { delay_minutes: number; focus: string };

export type AgenteFila = {
  whatsapp_account_id: string | null;
  provider: "openai" | "anthropic";
  model: string;
  agent_name: string;
  persona: string;
  is_active: boolean;
  followup_enabled?: boolean;
  followup_steps?: FollowupStep[];
  followup_template_id?: string | null;
};

export type LineaOpcion = { id: string; label: string | null; display_phone_number: string };

type MediaItem = {
  id: string;
  key: string;
  label: string;
  trigger_description: string;
  media_type: "image" | "video" | "audio" | "document";
  media_url: string;
};

type TemplateOption = { id: string; meta_template_name: string; language: string };

function etiqueta(l: LineaOpcion) {
  return l.label ? `${l.label} · ${l.display_phone_number}` : l.display_phone_number;
}

/**
 * Un agente de IA por linea (migracion 0118).
 *
 * Con una sola linea se ve igual que siempre. Con varias, arriba aparecen las
 * pestañas: "Otras líneas" (el agente que atiende las que no tengan uno
 * propio) y una por cada linea conectada.
 */
export function AgentesPorLinea({
  agentes,
  lineas,
  mediaItems = [],
  templates = [],
}: {
  agentes: AgenteFila[];
  lineas: LineaOpcion[];
  mediaItems?: MediaItem[];
  templates?: TemplateOption[];
}) {
  const [seleccion, setSeleccion] = useState<string | null>(() => {
    // Empieza en el agente general si existe; si no, en el primero que haya.
    if (agentes.some((a) => !a.whatsapp_account_id)) return null;
    return agentes[0]?.whatsapp_account_id ?? null;
  });

  const agenteDe = (lineaId: string | null) =>
    agentes.find((a) => (a.whatsapp_account_id ?? null) === lineaId) ?? null;

  const hayLlave = agentes.length > 0;

  if (lineas.length < 2) {
    return (
      <AiAgentPanel
        agent={agenteDe(null)}
        mediaItems={mediaItems}
        templates={templates}
        whatsappAccountId={null}
        hayLlaveEnElEspacio={hayLlave}
      />
    );
  }

  const pestanas: { id: string | null; nombre: string }[] = [
    { id: null, nombre: "Otras líneas" },
    ...lineas.map((l) => ({ id: l.id, nombre: etiqueta(l) })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[13px] border border-border bg-surface p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot size={16} className="text-primary" />
          Un agente por línea
        </div>
        <p className="mb-3 text-xs text-muted">
          Cada línea puede tener su propio agente, con su personalidad y sus seguimientos, y todos comparten la misma
          API key. Si una línea no tiene agente propio, responde el de <strong>Otras líneas</strong>; si tampoco existe,
          la IA no responde en esa línea.
        </p>
        <div className="flex flex-wrap gap-2">
          {pestanas.map((p) => {
            const a = agenteDe(p.id);
            const activa = (seleccion ?? null) === p.id;
            return (
              <button
                key={p.id ?? "general"}
                type="button"
                onClick={() => setSeleccion(p.id)}
                className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[13px] transition-colors ${
                  activa ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted hover:text-foreground"
                }`}
              >
                {p.nombre}
                {a ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      a.is_active ? "bg-success/15 text-success" : "border border-border text-muted"
                    }`}
                  >
                    {a.is_active ? "Activo" : "Pausado"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-muted">
                    <Plus size={10} /> Sin agente
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AiAgentPanel
        // Al cambiar de línea se vuelve a montar el formulario con sus datos.
        key={seleccion ?? "general"}
        agent={agenteDe(seleccion ?? null)}
        mediaItems={mediaItems}
        templates={templates}
        whatsappAccountId={seleccion ?? null}
        hayLlaveEnElEspacio={hayLlave}
      />
    </div>
  );
}
