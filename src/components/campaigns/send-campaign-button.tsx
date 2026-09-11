"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { sendCampaign } from "@/app/actions/campaigns";

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(null);
    // Returns as soon as the fast setup checks pass — the actual sending
    // keeps running server-side. Recipient statuses on this page update as
    // they go out (via the campaign's own realtime refresh).
    const result = await sendCampaign(campaignId);
    setPending(false);
    if (result && "error" in result) {
      setError(result.error ?? "Error desconocido.");
    } else {
      setStarted(true);
      router.refresh();
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || started}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        <Send size={14} />
        {pending ? "Iniciando..." : started ? "Enviando en segundo plano..." : "Enviar campaña"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {started && !error && (
        <p className="mt-2 text-xs text-muted">
          La campaña sigue enviándose de fondo — el estado de cada contacto se va actualizando abajo.
        </p>
      )}
    </div>
  );
}
