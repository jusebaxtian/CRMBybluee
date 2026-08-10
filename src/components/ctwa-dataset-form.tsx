"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { saveCtwaDatasetId } from "@/app/actions/whatsapp";
import { Button } from "@/components/ui/button";

export function CtwaDatasetForm({ datasetId }: { datasetId: string }) {
  const router = useRouter();
  const [value, setValue] = useState(datasetId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await saveCtwaDatasetId(value);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setMessage("Guardado.");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-2 flex items-center gap-2">
        <Target size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Reportar compras a Meta Ads (Conversions API)
        </h3>
      </div>
      <p className="mb-3 text-xs text-muted">
        Cuando un cliente que llegó por un anuncio &quot;Click to WhatsApp&quot; recibe una etiqueta
        marcada como &quot;Reportar compra&quot;, el CRM le avisa a Meta que ese clic terminó en venta —
        así el administrador de anuncios optimiza la campaña hacia gente parecida. Consigue el
        Dataset ID en Events Manager (Meta Business Suite), en la cuenta de datos vinculada a tu
        WhatsApp Business.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Dataset ID (ej: 1234567890)"
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        {message && <p className="text-sm text-success">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
