"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncTemplates } from "@/app/actions/templates";

export function SyncTemplatesButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setMessage(null);
    const result = await syncTemplates();
    setPending(false);
    if ("error" in result) {
      setMessage(result.error ?? "Ocurrió un error.");
    } else {
      setMessage(`${result.count} plantilla(s) sincronizada(s).`);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
        {pending ? "Sincronizando..." : "Sincronizar plantillas de Meta"}
      </button>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
