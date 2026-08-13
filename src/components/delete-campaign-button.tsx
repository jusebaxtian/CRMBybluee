"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteCampaign } from "@/app/actions/campaigns";

export function DeleteCampaignButton({ campaignId }: { campaignId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("¿Eliminar esta campaña en borrador? Esta acción no se puede deshacer.")) return;
    setPending(true);
    setError(null);
    const result = await deleteCampaign(campaignId);
    if (result && "error" in result) {
      setPending(false);
      setError(result.error ?? "Error desconocido.");
    }
    // On success the action redirects, so no need to reset state here.
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-md border border-red-400 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        <Trash2 size={13} />
        {pending ? "Eliminando..." : "Eliminar"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
