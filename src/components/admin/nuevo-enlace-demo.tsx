"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import { crearEnlaceDemo } from "@/app/actions/pagos-chat";

const INPUT =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";

/** Admin → Pagos: enlace demo para un prospecto que aun no esta en el chat. */
export function NuevoEnlaceDemo({ planes }: { planes: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(planes[0]?.id ?? "");
  const [dias, setDias] = useState("2");
  const [nombre, setNombre] = useState("");
  const [enlace, setEnlace] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generar() {
    setError(null);
    startTransition(async () => {
      const r = await crearEnlaceDemo({ planId, diasDemo: Number(dias), nombre });
      if (r.error) {
        setError(r.error);
        return;
      }
      setEnlace(r.enlace ?? null);
      router.refresh();
    });
  }

  async function copiar() {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  function cerrar() {
    setOpen(false);
    setEnlace(null);
    setNombre("");
    setError(null);
  }

  return (
    <div className="rounded-[13px] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Enlace demo (cuenta sin pago por unos días)</p>
          <p className="text-xs text-muted">
            Para prospectos: al registrarse con el enlace, su cuenta nace activa con el plan elegido durante los días que fijes.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-[10px] text-[12.5px] font-bold text-white hover:bg-primary-hover"
          >
            <Sparkles size={15} /> Nuevo enlace demo
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 rounded-[10px] border border-border bg-background p-3">
          {enlace ? (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Check size={15} className="text-success" /> Enlace demo listo. Toca para copiarlo:
              </p>
              <button
                type="button"
                onClick={copiar}
                title="Clic para copiar"
                className="flex w-full items-center gap-2 rounded-[9px] border border-border bg-surface px-3 py-2 text-left font-mono text-xs text-foreground hover:border-primary"
              >
                <span className="min-w-0 flex-1 truncate">{enlace}</span>
                {copiado ? <Check size={14} className="shrink-0 text-success" /> : <Copy size={14} className="shrink-0 text-muted" />}
              </button>
              <p className="text-[11px] text-muted">{copiado ? "Enlace copiado ✓" : "También queda en la lista de enlaces pendientes de abajo."}</p>
              <button type="button" onClick={cerrar} className="self-start text-xs text-muted hover:text-foreground">
                Cerrar
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end">
              <label className="text-xs font-medium text-muted">
                Plan
                <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={`${INPUT} mt-1`}>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">
                Días
                <input type="number" min={1} max={365} value={dias} onChange={(e) => setDias(e.target.value)} className={`${INPUT} mt-1`} />
              </label>
              <label className="text-xs font-medium text-muted">
                Para quién (opcional)
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ferretería El Tornillo" className={`${INPUT} mt-1`} />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generar}
                  disabled={pending || !planId}
                  className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {pending && <Loader2 size={13} className="animate-spin" />} Generar
                </button>
                <button type="button" onClick={cerrar} aria-label="Cancelar" className="text-muted hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
              {error && <p className="text-xs text-error sm:col-span-4">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
