"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Link2, Search, X } from "lucide-react";
import { buscarEspaciosParaVincular, vincularContactoAEspacio } from "@/app/actions/admin";

type Espacio = { id: string; nombre: string; estado: string; telefono: string | null; plan: string | null };

const ESTADO: Record<string, string> = { active: "Activo", trial: "En prueba", past_due: "Vencido", canceled: "Cancelado", suspended: "Suspendido" };

/**
 * Desde el chat (solo admin): liga este contacto a un espacio. Si el espacio no
 * tiene contacto queda como principal; si ya tiene, como adicional (hasta 5 en
 * total, 0191).
 */
export function VincularEspacioDialog({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const router = useRouter();
  const [termino, setTermino] = useState("");
  const [espacios, setEspacios] = useState<Espacio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  async function buscar(valor: string) {
    setTermino(valor);
    setError(null);
    if (valor.trim().length < 2) {
      setEspacios([]);
      return;
    }
    const r = await buscarEspaciosParaVincular(valor);
    if ("error" in r && r.error) {
      setError(r.error);
      return;
    }
    setEspacios("espacios" in r && r.espacios ? r.espacios : []);
  }

  function vincular(e: Espacio) {
    setError(null);
    startTransition(async () => {
      const r = await vincularContactoAEspacio(e.id, contactId);
      if ("error" in r) {
        setError(r.error ?? "No se pudo vincular.");
        return;
      }
      setHecho(
        "yaEstaba" in r && r.yaEstaba
          ? `Este chat ya estaba vinculado a ${e.nombre}.`
          : "principal" in r && r.principal
            ? `Vinculado a ${e.nombre} como contacto principal.`
            : `Vinculado a ${e.nombre} como contacto adicional.`
      );
      router.refresh();
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Vincular a un espacio"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 size={15} className="text-primary" /> Vincular a un espacio
          </p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted">
          Busca el espacio por nombre o por su teléfono de registro. Un espacio puede tener hasta 5 contactos vinculados; el primero queda como principal.
        </p>

        {hecho ? (
          <>
            <p className="rounded-lg bg-success/10 p-3 text-sm text-success">{hecho}</p>
            <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover">
              Listo
            </button>
          </>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={termino}
                onChange={(ev) => void buscar(ev.target.value)}
                placeholder="Nombre del espacio o teléfono"
                className="w-full rounded-[9px] border border-border bg-background py-2 pl-9 pr-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
            </div>
            {espacios.length > 0 && (
              <ul className="mt-2 max-h-72 overflow-y-auto rounded-[9px] border border-border">
                {espacios.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => vincular(e)}
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-hover disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-foreground">{e.nombre}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {[e.plan, ESTADO[e.estado] ?? e.estado, e.telefono].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-primary">Vincular</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {termino.trim().length >= 2 && espacios.length === 0 && !error && <p className="mt-2 text-xs text-muted">Sin coincidencias.</p>}
          </>
        )}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>,
    document.body
  );
}
