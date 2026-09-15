"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Bot } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

type Tab = "agents" | "whatsapp" | "ai";

type Props = {
  agentsContent: React.ReactNode;
  whatsappContent: React.ReactNode;
  aiAgentContent?: React.ReactNode;
};

/** ?tab=whatsapp abre directo esa pestaña (enlace desde el dashboard). */
export function SettingsTabs(props: Props) {
  return (
    <Suspense fallback={<SettingsTabsInner {...props} inicial="agents" />}>
      <SettingsTabsConUrl {...props} />
    </Suspense>
  );
}

function SettingsTabsConUrl(props: Props) {
  const t = useSearchParams().get("tab");
  const inicial: Tab = t === "whatsapp" || t === "ai" ? t : "agents";
  return <SettingsTabsInner {...props} inicial={inicial} />;
}

function SettingsTabsInner({ agentsContent, whatsappContent, aiAgentContent, inicial }: Props & { inicial: Tab }) {
  const [tab, setTab] = useState<Tab>(inicial);

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("agents")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "agents"
              ? "border-primary text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Users size={14} />
          Agentes de respuesta
        </button>
        <button
          type="button"
          onClick={() => setTab("whatsapp")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "whatsapp"
              ? "border-primary text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <WhatsAppIcon size={14} />
          WhatsApp API
        </button>
        {aiAgentContent && (
          <button
            type="button"
            onClick={() => setTab("ai")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === "ai"
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Bot size={14} />
            Agente de IA
          </button>
        )}
      </div>

      <div className={tab === "agents" ? "block" : "hidden"}>{agentsContent}</div>
      <div className={tab === "whatsapp" ? "block" : "hidden"}>{whatsappContent}</div>
      {aiAgentContent && <div className={tab === "ai" ? "block" : "hidden"}>{aiAgentContent}</div>}
    </div>
  );
}
