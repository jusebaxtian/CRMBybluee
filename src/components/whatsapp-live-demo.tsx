"use client";

import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { CheckCheck, Bot } from "lucide-react";

type Stage = "waiting" | "incoming" | "typing" | "replied";

const STAGE_DURATIONS: Record<Stage, number> = {
  waiting: 900,
  incoming: 1600,
  typing: 1500,
  replied: 3200,
};

const STAGE_ORDER: Stage[] = ["waiting", "incoming", "typing", "replied"];

export function WhatsAppLiveDemo() {
  const [stage, setStage] = useState<Stage>("waiting");

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextIndex = (STAGE_ORDER.indexOf(stage) + 1) % STAGE_ORDER.length;
      setStage(STAGE_ORDER[nextIndex]);
    }, STAGE_DURATIONS[stage]);
    return () => clearTimeout(timer);
  }, [stage]);

  const showCustomer = stage !== "waiting";
  const showTyping = stage === "typing";
  const showReply = stage === "replied";

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/15 blur-3xl" />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bot size={16} />
            {stage === "incoming" && (
              <span className="ping-ring absolute inset-0 rounded-full border-2 border-primary" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Agente de IA</p>
            <p className="text-[11px] text-muted">Seguimiento automático</p>
          </div>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Activo
          </span>
        </div>

        <div className="flex min-h-[220px] flex-col justify-end gap-2 bg-background/40 p-4">
          {showCustomer && (
            <div className="bubble-in flex justify-start">
              <div className="max-w-[75%] rounded-lg rounded-bl-sm bg-surface-hover px-3 py-2 text-xs text-foreground">
                Hola, ¿siguen teniendo el producto disponible?
              </div>
            </div>
          )}

          {showTyping && (
            <div className="bubble-in flex justify-end">
              <div className="flex items-center gap-1 rounded-lg rounded-br-sm bg-primary/20 px-3 py-2.5">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {showReply && (
            <div className="bubble-in flex justify-end">
              <div className="max-w-[80%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-xs text-white">
                <p>¡Hola! Sí, todavía tenemos disponibilidad 😊 ¿Quieres que te confirme el pedido?</p>
                <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/70">
                  <CheckCheck size={12} />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-background px-4 py-2.5 text-[11px] text-muted">
          <WhatsAppIcon size={13} className="text-success" />
          WhatsApp Business Cloud API
        </div>
      </div>
    </div>
  );
}
