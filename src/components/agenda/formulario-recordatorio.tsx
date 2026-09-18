"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, Trash2, X } from "lucide-react";
import {
  actualizarRecordatorio,
  buscarContactosParaRecordatorio,
  crearRecordatorioParaContacto,
  eliminarRecordatorio,
  type RecordatorioAgenda,
} from "@/app/actions/recordatorios";

export const INPUT_AGENDA =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";

/** Valor para <input type="datetime-local"> en hora local del navegador. */
export function aLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Contacto = { id: string; nombre: string; wa_id: string };

/**
 * Dialogo de la Agenda: crea (buscando el contacto) o edita un recordatorio.
 */
export function FormularioRecordatorio({
  existente,
  fechaInicial,
  onClose,
  onGuardado,
}: {
  existente?: RecordatorioAgenda | null;
  /** Para "nuevo" desde un dia del calendario. */
  fechaInicial?: Date;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [texto, setTexto] = useState(existente?.texto ?? "");
  const [cuando, setCuando] = useState(() =>
    aLocal(existente ? new Date(existente.recordar_en) : fechaInicial ?? new Date(Date.now() + 60 * 60 * 1000))
  );
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Contacto[]>([]);
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busqueda con retardo desde el propio manejador de escritura.
  function escribirBusqueda(valor: string) {
    setBusqueda(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    const q = valor.trim();
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    temporizador.current = setTimeout(() => {
      buscarContactosParaRecordatorio(q).then(setResultados);
    }, 250);
  }

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onClose]);

  function guardar() {
    setError(null);
    startTransition(async () => {
      const recordarEn = new Date(cuando).toISOString();
      const r = existente
        ? await actualizarRecordatorio({ id: existente.id, texto, recordarEn })
        : contacto
          ? await crearRecordatorioParaContacto({ contactId: contacto.id, texto, recordarEn })
          : { error: "Elige el contacto." };
      if (r?.error) {
        setError(r.error);
        return;
      }
      onGuardado();
    });
  }

  function borrar() {
    if (!existente) return;
    startTransition(async () => {
      await eliminarRecordatorio(existente.id);
      onGuardado();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative flex w-full flex-col gap-3 rounded-t-2xl border border-border bg-surface p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            {existente ? `Recordatorio · ${existente.contacto}` : "Nuevo recordatorio"}
          </p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {!existente && (
          <div>
            <label className="text-xs font-medium text-muted">Contacto</label>
            {contacto ? (
              <div className="mt-1 flex items-center justify-between rounded-[9px] border border-primary/50 bg-primary/10 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {contacto.nombre} <span className="text-muted">· {contacto.wa_id}</span>
                </span>
                <button type="button" onClick={() => setContacto(null)} className="text-xs text-muted hover:text-foreground">
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={busqueda}
                  onChange={(e) => escribirBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o número…"
                  autoFocus
                  className={`${INPUT_AGENDA} pl-9`}
                />
                {resultados.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-[9px] border border-border bg-surface shadow-xl">
                    {resultados.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setContacto(c);
                            setResultados([]);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-hover"
                        >
                          <span className="truncate text-foreground">{c.nombre}</span>
                          <span className="ml-2 shrink-0 text-xs text-muted">{c.wa_id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <label className="text-xs font-medium text-muted">
          ¿Cuándo?
          <input
            type="datetime-local"
            value={cuando}
            min={aLocal(new Date())}
            onChange={(e) => setCuando(e.target.value)}
            className={`${INPUT_AGENDA} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-muted">
          ¿Qué recordar?
          <input
            value={texto}
            maxLength={200}
            placeholder="Ej: Llamar cliente"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") guardar();
            }}
            className={`${INPUT_AGENDA} mt-1`}
          />
        </label>

        {existente?.avisado_en && (
          <p className="rounded-[9px] border border-border bg-background px-3 py-2 text-xs text-muted">
            ✓ Avisado el {new Date(existente.avisado_en).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.
            Queda como historial 60 días. Si guardas una fecha nueva, vuelve a programarse.
          </p>
        )}
        {error && <p className="text-xs text-error">{error}</p>}

        <div className="flex items-center gap-2">
          {existente && (
            <button
              type="button"
              onClick={borrar}
              disabled={pending}
              title="Eliminar recordatorio"
              className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-border text-muted hover:border-error hover:text-error disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={pending || !texto.trim() || (!existente && !contacto)}
            className="flex flex-1 items-center justify-center gap-2 rounded-[9px] bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {existente ? "Guardar cambios" : "Programar"}
          </button>
        </div>
        {existente && (
          <a href={`/dashboard/inbox/${existente.conversation_id}`} className="text-center text-xs text-primary hover:underline">
            Ir al chat de {existente.contacto}
          </a>
        )}
      </div>
    </div>
  );
}
