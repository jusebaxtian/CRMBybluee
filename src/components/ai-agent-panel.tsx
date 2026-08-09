"use client";

import { useActionState, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { saveAiAgent, toggleAiAgentActive } from "@/app/actions/ai-agent";
import { AiAgentMediaLibrary } from "@/components/ai-agent-media-library";
import { AiAgentTestChat } from "@/components/ai-agent-test-chat";
import { Button } from "@/components/ui/button";

type FollowupStep = { delay_minutes: number; focus: string };

type AiAgent = {
  provider: "openai" | "anthropic";
  model: string;
  agent_name: string;
  persona: string;
  is_active: boolean;
  followup_enabled?: boolean;
  followup_steps?: FollowupStep[];
  followup_template_id?: string | null;
} | null;

type MediaItem = {
  id: string;
  key: string;
  label: string;
  trigger_description: string;
  media_type: "image" | "video" | "audio" | "document";
  media_url: string;
};

type TemplateOption = {
  id: string;
  meta_template_name: string;
  language: string;
};

type DelayUnit = "minutes" | "hours" | "days";
type StepDraft = { delayValue: number; delayUnit: DelayUnit; focus: string };

const MINUTES_PER_UNIT: Record<DelayUnit, number> = { minutes: 1, hours: 60, days: 1440 };

// Picks the cleanest unit to show an existing delay in (e.g. 2880 minutes
// reads better as "2 días" than "2880 minutos").
function minutesToParts(minutes: number): { value: number; unit: DelayUnit } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

const DEFAULT_STEPS: StepDraft[] = [
  { delayValue: 5, delayUnit: "minutes", focus: "Invitar al cliente a unirse al grupo/comunidad." },
  { delayValue: 1, delayUnit: "hours", focus: "Enviar testimonios de otros clientes satisfechos." },
  {
    delayValue: 3,
    delayUnit: "hours",
    focus: "Persuadir tocando el dolor/problema del cliente y generar deseo de resolverlo.",
  },
  {
    delayValue: 24,
    delayUnit: "hours",
    focus:
      "Generar deseo de seguir la conversación haciendo una pregunta con la que el cliente se identifique.",
  },
];

export function AiAgentPanel({
  agent,
  mediaItems = [],
  templates = [],
}: {
  agent: AiAgent;
  mediaItems?: MediaItem[];
  templates?: TemplateOption[];
}) {
  const [state, action, pending] = useActionState(saveAiAgent, undefined);
  const [provider, setProvider] = useState<"openai" | "anthropic">(agent?.provider ?? "openai");
  const [active, setActive] = useState(agent?.is_active ?? false);
  const [togglePending, setTogglePending] = useState(false);
  const [followupEnabled, setFollowupEnabled] = useState(agent?.followup_enabled ?? false);
  const [steps, setSteps] = useState<StepDraft[]>(() => {
    if (agent?.followup_steps && agent.followup_steps.length > 0) {
      return agent.followup_steps.map((s) => {
        const { value, unit } = minutesToParts(s.delay_minutes);
        return { delayValue: value, delayUnit: unit, focus: s.focus };
      });
    }
    return DEFAULT_STEPS;
  });

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, { delayValue: 1, delayUnit: "hours", focus: "" }]);
  }
  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }
  const stepsJson = JSON.stringify(
    steps.map((s) => ({ delay_minutes: s.delayValue * MINUTES_PER_UNIT[s.delayUnit], focus: s.focus }))
  );

  async function handleToggle() {
    setTogglePending(true);
    const next = !active;
    const result = await toggleAiAgentActive(next);
    if (!result?.error) setActive(next);
    setTogglePending(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {agent && (
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                active ? "bg-success/15 text-success" : "bg-surface-hover text-muted"
              }`}
            >
              <Bot size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {active ? "Agente de IA activo" : "Agente de IA pausado"}
              </p>
              <p className="text-xs text-muted">
                {active
                  ? "Está respondiendo automáticamente a tus clientes por WhatsApp."
                  : "Configurado, pero no responde a nadie todavía."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={togglePending}
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              active
                ? "border border-red-400/40 text-red-400 hover:bg-red-400/10"
                : "bg-primary text-white hover:bg-primary-hover"
            }`}
          >
            {active ? "Pausar" : "Activar"}
          </button>
        </div>
      )}

      {agent && <AiAgentTestChat />}

      <div className="rounded-xl border border-border p-5">
      <form id="ai-agent-config-form" action={action} className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {agent ? "Actualizar configuración" : "Conectar tu IA"}
          </h3>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Proveedor</label>
          <select
            name="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "openai" | "anthropic")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="openai">OpenAI (GPT)</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Tu API key</label>
          <input
            name="apiKey"
            type="password"
            required={!agent}
            placeholder={
              agent
                ? "Déjalo vacío para mantener la llave guardada"
                : provider === "openai"
                  ? "sk-..."
                  : "sk-ant-..."
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted">
            {agent
              ? "Solo llénalo si quieres reemplazar la llave actual."
              : provider === "openai"
                ? "La consigues en platform.openai.com → API keys."
                : "La consigues en console.anthropic.com → API keys."}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Modelo (opcional)</label>
          <input
            name="model"
            type="text"
            defaultValue={agent?.model ?? ""}
            placeholder={provider === "openai" ? "gpt-4o-mini" : "claude-sonnet-5"}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nombre del vendedor</label>
          <input
            name="agentName"
            type="text"
            defaultValue={agent?.agent_name ?? ""}
            placeholder="Ej: Camila"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            ¿Qué debe saber para vender bien?
          </label>
          <textarea
            name="persona"
            rows={6}
            defaultValue={agent?.persona ?? ""}
            placeholder={
              "Ej: Vendemos zapatos deportivos. Precios entre $80.000 y $250.000. Envío gratis en pedidos +$150.000. Tono cercano, cero formal, usa emojis con moderación. Si preguntan por descuentos, ofrece 10% pagando de contado."
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted">
            Entre más detalle des (productos, precios, políticas, tono), mejor va a vender.
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              name="followupEnabled"
              checked={followupEnabled}
              onChange={(e) => setFollowupEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Seguimientos automáticos
          </label>
          <p className="mt-1 text-[11px] text-muted">
            Si el cliente no responde, la IA escribe un seguimiento por su cuenta. Dentro de las 24h
            desde el último mensaje del cliente escribe texto libre; pasadas las 24h, WhatsApp exige
            usar una plantilla aprobada.
          </p>

          {followupEnabled && (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">
                    Pasos del seguimiento (en orden)
                  </label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    + Agregar paso
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {steps.map((step, i) => (
                    <div key={i} className="rounded-md border border-border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted">Paso {i + 1}</span>
                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(i)}
                            className="text-[11px] text-red-400 hover:underline"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="flex shrink-0 gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={step.delayValue}
                            onChange={(e) => updateStep(i, { delayValue: Number(e.target.value) })}
                            className="w-20 rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                          />
                          <select
                            value={step.delayUnit}
                            onChange={(e) => updateStep(i, { delayUnit: e.target.value as DelayUnit })}
                            className="rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                          >
                            <option value="minutes">Minutos</option>
                            <option value="hours">Horas</option>
                            <option value="days">Días</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={step.focus}
                          onChange={(e) => updateStep(i, { focus: e.target.value })}
                          placeholder="Enfoque de este seguimiento (ej: invitar al grupo, enviar testimonios...)"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Cada paso se cuenta desde que el cliente dejó de responder (no desde el paso
                  anterior). La IA redacta el mensaje siguiendo ese enfoque.
                </p>
                <input type="hidden" name="followupSteps" value={stepsJson} />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Plantilla para reabrir tras 24h
                </label>
                <select
                  name="followupTemplateId"
                  defaultValue={agent?.followup_template_id ?? ""}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">Selecciona una plantilla aprobada</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.meta_template_name} ({t.language})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  WhatsApp exige una plantilla aprobada para reabrir la conversación pasadas las 24h
                  sin respuesta del cliente — este es el mensaje que se usa en ese caso, sin importar
                  cuál paso corresponda.
                </p>
                {templates.length === 0 && (
                  <p className="mt-1 text-[11px] text-red-400">
                    No tienes plantillas aprobadas todavía — crea una en Plantillas.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

      </form>

      {agent && (
        <div className="mt-5 border-t border-border pt-5">
          <AiAgentMediaLibrary items={mediaItems} />
        </div>
      )}

      <div className="mt-5 border-t border-border pt-5">
        {state && "error" in state && (
          <p className="mb-3 text-sm text-red-400">{state.error}</p>
        )}
        {state && "success" in state && (
          <p className="mb-3 text-sm text-success">Guardado — probamos tu API key y funciona.</p>
        )}
        <Button type="submit" form="ai-agent-config-form" disabled={pending}>
          {pending ? "Validando y guardando..." : agent ? "Guardar cambios" : "Conectar"}
        </Button>
      </div>
      </div>
    </div>
  );
}
