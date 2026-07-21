"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";

export function SettingsTabs({
  agentsContent,
  whatsappContent,
}: {
  agentsContent: React.ReactNode;
  whatsappContent: React.ReactNode;
}) {
  const [tab, setTab] = useState<"agents" | "whatsapp">("agents");

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
      </div>

      <div className={tab === "agents" ? "block" : "hidden"}>{agentsContent}</div>
      <div className={tab === "whatsapp" ? "block" : "hidden"}>{whatsappContent}</div>
    </div>
  );
}
