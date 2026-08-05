"use client";

import { useActionState, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { saveAiAgent, toggleAiAgentActive } from "@/app/actions/ai-agent";
import { AiAgentMediaLibrary } from "@/components/ai-agent-media-library";

type AiAgent = {
  provider: "openai" | "anthropic";
  model: string;
  agent_name: string;
  persona: string;
  is_active: boolean;
} | null;

type MediaItem = {
  id: string;
  key: string;
  label: string;
  trigger_description: string;
  media_type: "image" | "video" | "document";
  media_url: string;
};

export function AiAgentPanel({
  agent,
  mediaItems = [],
}: {
  agent: AiAgent;
  mediaItems?: MediaItem[];
}) {
  const [state, action, pending] = useActionState(saveAiAgent, undefined);
  const [provider, setProvider] = useState<"openai" | "anthropic">(agent?.provider ?? "openai");
  const [active, setActive] = useState(agent?.is_active ?? false);
  const [togglePending, setTogglePending] = useState(false);

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

      <form action={action} className="flex flex-col gap-4 rounded-xl border border-border p-5">
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
            required
            placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-[11px] text-muted">
            {provider === "openai"
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

        {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
        {state && "success" in state && (
          <p className="text-sm text-success">Guardado — probamos tu API key y funciona.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "Validando y guardando..." : agent ? "Guardar cambios" : "Conectar"}
        </button>
      </form>

      {agent && <AiAgentMediaLibrary items={mediaItems} />}
    </div>
  );
}
