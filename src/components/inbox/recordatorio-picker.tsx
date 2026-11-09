"use client";

import { useState, useTransition } from "react";
import { AlarmClock, Bell, Check, Loader2, Send, Trash2, X } from "lucide-react";
import { ProgramarMensajePanel, type PlantillaParaProgramar } from "@/components/inbox/programar-mensaje";
import {
  actualizarRecordatorio,
  crearRecordatorio,
  eliminarRecordatorio,
  googleListoParaRecordatorios,
  listarRecordatorios,
} from "@/app/actions/recordatorios";

type Pendiente = { id: string; texto: string; recordar_en: string };

const INPUT =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";

// Valor para <input type="datetime-local"> en hora local del navegador.
function aLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Boton del reloj en el grupo flotante del chat. Abre un menu con dos opciones:
 * - Crear recordatorio: al vencer llega a la campana con "Ir al chat".
 * - Programar mensaje (0177): sale solo a la hora elegida.
 */
export function RecordatorioPicker({
  conversationId,
  contactName,
  plantillas = [],
  lastInboundAt = null,
}: {
  conversationId: string;
  contactName: string;
  plantillas?: PlantillaParaProgramar[];
  lastInboundAt?: string | null;
}) {
  const [modo, setModo] = useState<"menu" | "recordatorio" | "mensaje" | null>(null);
  const open = modo === "recordatorio";
  const setOpen = (abierto: boolean) => setModo(abierto ? "recordatorio" : null);
  const [texto, setTexto] = useState("");
  const [cuando, setCuando] = useState(() => aLocal(new Date(Date.now() + 60 * 60 * 1000)));
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [googleListo, setGoogleListo] = useState(false);
  const [enGoogle, setEnGoogle] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  function editar(r: Pendiente) {
    setEditandoId(r.id);
    setTexto(r.texto);
    setCuando(aLocal(new Date(r.recordar_en)));
    setError(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setTexto("");
    setCuando(aLocal(new Date(Date.now() + 60 * 60 * 1000)));
  }

  function abrirRecordatorio() {
    setOpen(true);
    listarRecordatorios(conversationId).then(setPendientes);
    googleListoParaRecordatorios().then(setGoogleListo);
  }

  function borrar(id: string) {
    startTransition(async () => {
      await eliminarRecordatorio(id);
      setPendientes((p) => p.filter((r) => r.id !== id));
    });
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const recordarEn = new Date(cuando).toISOString();
      const r = editandoId
        ? await actualizarRecordatorio({ id: editandoId, texto, recordarEn })
        : await crearRecordatorio({ conversationId, texto, recordarEn, enGoogle: googleListo && enGoogle });
      if (r?.error) {
        setError(r.error);
        return;
      }
      const avisoGoogle = (r as { aviso?: string }).aviso ?? null;
      setAviso(avisoGoogle);
      setListo(true);
      listarRecordatorios(conversationId).then(setPendientes);
      setTimeout(() => {
        setListo(false);
        setOpen(false);
        setEditandoId(null);
        setTexto("");
        setAviso(null);
      }, avisoGoogle ? 3500 : 1200);
    });
  }

  return (
    <div className="relative">
      {modo === "menu" && (
        <div role="menu" className="absolute left-full top-1/2 z-20 ml-2 w-52 -translate-y-1/2 rounded-[13px] border border-border bg-surface p-1.5 shadow-xl">
          <button
            type="button"
            role="menuitem"
            onClick={abrirRecordatorio}
            className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover"
          >
            <Bell size={15} className="text-muted" /> Crear recordatorio
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setModo("mensaje")}
            className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover"
          >
            <Send size={15} className="text-muted" /> Programar mensaje
          </button>
        </div>
      )}
      {modo === "mensaje" && (
        <ProgramarMensajePanel
          conversationId={conversationId}
          contactName={contactName}
          plantillas={plantillas}
          lastInboundAt={lastInboundAt}
          onClose={() => setModo(null)}
        />
      )}
      {open && (
        <div className="absolute left-full top-1/2 z-20 ml-2 w-72 -translate-y-1/2 rounded-[13px] border border-border bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Recordatorio · {contactName}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-foreground" aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>
          {listo ? (
            <div className="py-2">
              <p className="flex items-center gap-2 text-sm text-success">
                <Check size={15} /> {editandoId ? "Recordatorio actualizado" : "Recordatorio programado"}
              </p>
              {aviso && <p className="mt-1 text-xs text-warning">{aviso}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted">
                ¿Cuándo?
                <input
                  type="datetime-local"
                  value={cuando}
                  min={aLocal(new Date())}
                  onChange={(e) => setCuando(e.target.value)}
                  className={`${INPUT} mt-1`}
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
                  className={`${INPUT} mt-1`}
                  autoFocus
                />
              </label>
              {googleListo && !editandoId && (
                <label className="flex items-center gap-2 text-xs text-foreground">
                  <input type="checkbox" checked={enGoogle} onChange={(e) => setEnGoogle(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
                  Agregar también a mi Google Calendar
                </label>
              )}
              {error && <p className="text-xs text-error">{error}</p>}
              <button
                type="button"
                onClick={guardar}
                disabled={pending || !texto.trim()}
                className="flex items-center justify-center gap-2 rounded-[9px] bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                {editandoId ? "Guardar cambios" : "Programar"}
              </button>
              {editandoId && (
                <button type="button" onClick={cancelarEdicion} className="text-xs text-muted hover:text-foreground">
                  Cancelar edición
                </button>
              )}
              <p className="text-[11px] text-muted">Te avisará en la campana con un botón para abrir este chat.</p>
              {pendientes.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1 border-t border-border pt-2">
                  {pendientes.map((r) => (
                    <li key={r.id} className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => editar(r)}
                        title="Editar"
                        className={`min-w-0 flex-1 truncate text-left hover:underline ${editandoId === r.id ? "text-primary" : "text-foreground"}`}
                      >
                        <span className="text-muted">
                          {new Date(r.recordar_en).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>{" "}
                        · {r.texto}
                      </button>
                      <button type="button" onClick={() => borrar(r.id)} title="Eliminar" className="text-muted hover:text-error">
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setModo(modo ? null : "menu")}
        title="Recordatorio o mensaje programado"
        aria-label="Recordatorio o mensaje programado"
        aria-haspopup="menu"
        aria-expanded={modo !== null}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          modo ? "bg-primary text-white" : "text-muted hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <AlarmClock size={18} />
      </button>
    </div>
  );
}
