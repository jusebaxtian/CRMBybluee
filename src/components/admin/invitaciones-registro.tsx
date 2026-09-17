"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import { cancelarInvitacionRegistro } from "@/app/actions/pagos-chat";

export type InvitacionFila = {
  id: string;
  enlace: string;
  phone: string;
  contacto: string | null;
  plan: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  tipo: "pago" | "demo";
  dias_demo: number | null;
};

/** Admin → Pagos: enlaces de registro con pago que aun nadie ha usado. */
export function InvitacionesRegistro({ filas }: { filas: InvitacionFila[] }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(f: InvitacionFila) {
    try {
      await navigator.clipboard.writeText(f.enlace);
      setCopiado(f.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setCopiado(null);
    }
  }

  async function cancelar(id: string) {
    if (!confirm("¿Anular este enlace? Dejará de funcionar.")) return;
    await cancelarInvitacionRegistro(id);
    router.refresh();
  }

  if (filas.length === 0) return null;

  return (
    <div className="rounded-[13px] border border-border bg-surface p-5">
      <p className="text-sm font-semibold text-foreground">Enlaces de registro pendientes de usar</p>
      <p className="mb-3 text-xs text-muted">Con pago (desde el chat) o demo. Desaparecen cuando el cliente crea su cuenta. Toca el enlace para copiarlo.</p>
      <ul className="flex flex-col gap-2">
        {filas.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-background px-3 py-2 text-xs">
            <div className="min-w-[160px]">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                {f.contacto || f.phone || "Sin nombre"}
                {f.tipo === "demo" && (
                  <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    Demo · {f.dias_demo ?? 2} días
                  </span>
                )}
              </p>
              <p className="text-muted">
                {[
                  f.phone || null,
                  f.plan,
                  f.tipo === "demo"
                    ? "sin pago"
                    : new Intl.NumberFormat("es-CO", { style: "currency", currency: f.currency || "COP", maximumFractionDigits: 0 }).format(f.amount_cents / 100),
                  new Date(f.created_at).toLocaleDateString("es-CO"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copiar(f)}
              title="Clic para copiar"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left font-mono text-[11px] text-foreground hover:border-primary"
            >
              <span className="min-w-0 flex-1 truncate">{f.enlace}</span>
              {copiado === f.id ? <Check size={13} className="shrink-0 text-success" /> : <Copy size={13} className="shrink-0 text-muted" />}
            </button>
            <button
              type="button"
              onClick={() => cancelar(f.id)}
              title="Anular enlace"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-error"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
