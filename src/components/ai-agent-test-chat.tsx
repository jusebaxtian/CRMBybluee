"use client";

import { useState } from "react";
import { FlaskConical, Paperclip, User, Bot, RotateCcw } from "lucide-react";
import { testAiAgentMessage } from "@/app/actions/ai-agent";

type Turn = {
  role: "user" | "assistant";
  content: string;
  handoff?: boolean;
  media?: { key: string; label: string }[];
};

export function AiAgentTestChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const message = input.trim();
    if (!message || pending) return;

    setInput("");
    setError(null);
    const nextTurns: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(nextTurns);
    setPending(true);

    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    const result = await testAiAgentMessage(history, message);

    if ("error" in result) {
      setError(result.error ?? "Error desconocido.");
      setPending(false);
      return;
    }

    setTurns([
      ...nextTurns,
      { role: "assistant", content: result.reply, handoff: result.handoff, media: result.media },
    ]);
    setPending(false);
  }

  function handleReset() {
    setTurns([]);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left hover:bg-surface-hover"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FlaskConical size={14} className="text-primary" />
          Probar el agente
        </span>
        <span className="text-xs text-muted">{open ? "Ocultar" : "Escribirle como cliente"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
          <p className="text-xs text-muted">
            Escribe como si fueras un cliente. Esto usa tu configuración guardada, pero no envía
            nada por WhatsApp ni queda registrado en ninguna conversación real.
          </p>

          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {turns.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted">
                Escribe abajo para empezar la prueba.
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="flex max-w-[85%] flex-col gap-1">
                  <div
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                      t.role === "user"
                        ? "bg-primary text-white"
                        : "border border-border bg-surface text-foreground"
                    }`}
                  >
                    {t.role === "assistant" && <Bot size={14} className="mt-0.5 shrink-0" />}
                    {t.role === "user" && <User size={14} className="mt-0.5 shrink-0" />}
                    <span className="whitespace-pre-wrap">{t.content || "(sin texto)"}</span>
                  </div>
                  {t.media && t.media.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {t.media.map((m) => (
                        <span
                          key={m.key}
                          className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                        >
                          <Paperclip size={10} />
                          Enviaría: {m.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {t.handoff && (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] text-warning">
                      Aquí pasaría el chat a un humano
                    </span>
                  )}
                </div>
              </div>
            ))}
            {pending && <p className="text-xs text-muted">Escribiendo...</p>}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ej: Hola, cuánto cuesta..."
              disabled={pending}
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={pending || !input.trim()}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              Enviar
            </button>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                title="Reiniciar prueba"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
