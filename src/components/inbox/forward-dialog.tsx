"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Search, X, AlertCircle, Forward } from "lucide-react";
import { buscarContactosParaReenviar, reenviarMensaje, type ResultadoReenvio } from "@/app/actions/reenviar";

type Contacto = { id: string; name: string | null; wa_id: string };

/**
 * "Reenviar a…": elegir uno o varios chats y mandarles el mismo mensaje.
 * Se buscan contactos por nombre o número; el envio se hace en el servidor,
 * chat por chat, y aqui se muestra que salio bien y que no (p. ej. fuera de
 * la ventana de 24 h).
 */
export function ForwardDialog({
  messageId,
  preview,
  excludeContactId,
  onClose,
}: {
  messageId: string;
  preview: string;
  /** El contacto del chat actual no aparece como destino. */
  excludeContactId: string;
  onClose: () => void;
}) {
  const [termino, setTermino] = useState("");
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegidos, setElegidos] = useState<Map<string, Contacto>>(new Map());
  const [resultados, setResultados] = useState<ResultadoReenvio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const ultimaBusqueda = useRef(0);

  // Busqueda con pequeño retraso para no consultar en cada tecla.
  useEffect(() => {
    const id = ++ultimaBusqueda.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarContactosParaReenviar(termino);
      if (id !== ultimaBusqueda.current) return;
      setBuscando(false);
      setContactos(r.contactos.filter((c) => c.id !== excludeContactId));
    }, termino ? 250 : 0);
    return () => clearTimeout(t);
  }, [termino, excludeContactId]);

  useEffect(() => {
    inputRef.current?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onClose]);

  function alternar(c: Contacto) {
    setElegidos((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });
  }

  function enviar() {
    setError(null);
    startEnviar(async () => {
      const r = await reenviarMensaje({ messageId, contactIds: [...elegidos.keys()] });
      if ("error" in r) {
        setError(r.error ?? "No se pudo reenviar.");
        return;
      }
      setResultados(r.resultados ?? []);
    });
  }

  const nombreDe = (c: Contacto) => c.name?.trim() || c.wa_id;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:max-w-md sm:rounded-2xl animate-[reveal-up_0.2s_ease-out]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Forward size={16} className="text-primary" />
            Reenviar a…
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mx-4 mt-3 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">
          {preview}
        </p>

        {resultados ? (
          <div className="flex-1 overflow-y-auto p-4">
            <ul className="flex flex-col gap-2">
              {resultados.map((r) => (
                <li key={r.contactId} className="flex items-start gap-2 text-sm">
                  {r.ok ? (
                    <Check size={16} className="mt-0.5 shrink-0 text-success" />
                  ) : (
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-error" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{r.nombre}</span>
                    {!r.ok && <span className="block text-xs text-error">{r.error}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-[10px] bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
            >
              Listo
            </button>
          </div>
        ) : (
          <>
            <div className="relative mx-4 mt-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                value={termino}
                onChange={(e) => setTermino(e.target.value)}
                placeholder="Buscar por nombre o número"
                className="h-10 w-full rounded-[9px] border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>

            {elegidos.size > 0 && (
              <div className="mx-4 mt-2 flex flex-wrap gap-1.5">
                {[...elegidos.values()].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => alternar(c)}
                    className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {nombreDe(c)}
                    <X size={11} />
                  </button>
                ))}
              </div>
            )}

            <ul className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
              {buscando && contactos.length === 0 && (
                <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" /> Buscando…
                </li>
              )}
              {!buscando && contactos.length === 0 && (
                <li className="px-2 py-3 text-sm text-muted">Sin resultados.</li>
              )}
              {contactos.map((c) => {
                const activo = elegidos.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => alternar(c)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-hover ${
                        activo ? "bg-primary/10" : ""
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-sm font-semibold text-success">
                        {nombreDe(c).charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{nombreDe(c)}</span>
                        {c.name && <span className="block text-xs text-muted">{c.wa_id}</span>}
                      </span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          activo ? "border-primary bg-primary text-white" : "border-border"
                        }`}
                      >
                        {activo && <Check size={12} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {error && <p className="mx-4 mb-2 text-xs text-error">{error}</p>}

            <div className="border-t border-border p-3">
              <button
                type="button"
                disabled={elegidos.size === 0 || enviando}
                onClick={enviar}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {enviando
                  ? "Reenviando…"
                  : elegidos.size === 0
                    ? "Elige un chat"
                    : `Reenviar a ${elegidos.size} ${elegidos.size === 1 ? "chat" : "chats"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
