"use client";

import { useState, useTransition } from "react";
import { cambiarVendedorActivo, guardarInstruccionesDelVendedor, probarVendedor } from "@/app/actions/agente-vendedor";
import { ESTILO_ETAPA, ETAPAS, type Etapa } from "@/lib/leads/etapas";

type Turno = { role: "user" | "assistant"; content: string; nota?: string };

export function AgenteVendedorPanel({
  nombre,
  activo,
  instrucciones,
  conexion,
  automatizacionesAPausar,
}: {
  nombre: string;
  activo: boolean;
  instrucciones: string;
  /** Proveedor y modelo de la llave conectada. Null si no hay ninguna. */
  conexion: string | null;
  automatizacionesAPausar: string[];
}) {
  const [encendido, setEncendido] = useState(activo);
  const [texto, setTexto] = useState(instrucciones);
  const [guardado, setGuardado] = useState(instrucciones);
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null);
  const [ocupado, startTransition] = useTransition();

  const [etapa, setEtapa] = useState<Etapa>("frio");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [probando, setProbando] = useState(false);
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null);

  const sinGuardar = texto !== guardado;

  function cambiarEstado() {
    const nuevo = !encendido;
    setAviso(null);
    startTransition(async () => {
      if (nuevo && sinGuardar) {
        setAviso({ error: true, texto: "Guarda las instrucciones antes de encenderlo." });
        return;
      }
      const r = await cambiarVendedorActivo(nuevo);
      if (r.error) {
        setAviso({ error: true, texto: r.error });
        return;
      }
      setEncendido(nuevo);
      setAviso({ error: false, texto: nuevo ? `${nombre} está atendiendo tus chats.` : `${nombre} está apagado y tus automatizaciones volvieron.` });
    });
  }

  function guardar() {
    setAviso(null);
    startTransition(async () => {
      const r = await guardarInstruccionesDelVendedor(texto);
      if (r.error) {
        setAviso({ error: true, texto: r.error });
        return;
      }
      setGuardado(texto);
      setAviso({ error: false, texto: "Instrucciones guardadas." });
    });
  }

  async function enviarPrueba(e: React.FormEvent) {
    e.preventDefault();
    const m = mensaje.trim();
    if (!m || probando) return;
    setProbando(true);
    setErrorPrueba(null);
    setMensaje("");
    const historial = turnos.map(({ role, content }) => ({ role, content }));
    setTurnos((t) => [...t, { role: "user", content: m }]);
    const r = await probarVendedor({ instrucciones: texto, etapa, historial, mensaje: m });
    setProbando(false);
    if ("error" in r) {
      setErrorPrueba(r.error ?? "No se pudo probar.");
      return;
    }
    const notas = [
      r.adjuntos.length > 0 ? `Enviaría: ${r.adjuntos.join(", ")}` : null,
      r.pasaAPersona ? "Aquí pasaría el chat a una persona" : null,
    ].filter(Boolean);
    setTurnos((t) => [...t, { role: "assistant", content: r.respuesta, nota: notas.join(" · ") || undefined }]);
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div className="rounded-[13px] border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{encendido ? `${nombre} está encendido` : `${nombre} está apagado`}</p>
              <p className="mt-0.5 text-xs text-muted">{conexion ? `Usa la llave de tu espacio: ${conexion}` : "No hay una llave de IA conectada en tu espacio."}</p>
            </div>
            <button
              type="button"
              onClick={cambiarEstado}
              disabled={ocupado}
              aria-pressed={encendido}
              aria-label={encendido ? `Apagar a ${nombre}` : `Encender a ${nombre}`}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${encendido ? "border-primary bg-primary" : "border-border bg-surface-hover"}`}
            >
              <span className={`absolute left-1 top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${encendido ? "translate-x-[18px]" : "translate-x-0"}`} />
            </button>
          </div>
          {!encendido && automatizacionesAPausar.length > 0 && (
            <p className="mt-3 rounded-lg bg-warning/10 p-2.5 text-xs text-foreground">
              Al encenderlo responderá en todos tus chats y se pausarán estas automatizaciones hasta que lo apagues: {automatizacionesAPausar.join(", ")}.
            </p>
          )}
          {aviso && <p className={`mt-3 text-xs ${aviso.error ? "text-red-400" : "text-success"}`}>{aviso.texto}</p>}
        </div>

        <div className="rounded-[13px] border border-border bg-surface p-4">
          <label htmlFor="instrucciones" className="text-sm font-semibold text-foreground">Entrenamiento</label>
          <p className="mt-0.5 text-xs text-muted">Qué vende, precios, cómo habla y cómo resuelve objeciones. Empezó con lo que tenía el agente de tu línea de Ventas.</p>
          <textarea
            id="instrucciones"
            rows={18}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="mt-2 w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={guardar}
            disabled={ocupado || !sinGuardar}
            className="mt-2 rounded-[9px] bg-primary px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {sinGuardar ? "Guardar" : "Guardado"}
          </button>
        </div>
      </div>

      <div className="flex flex-col rounded-[13px] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Probar a {nombre}</p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              El cliente está
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value as Etapa)}
                className="rounded-[9px] border border-border bg-background px-2 py-1 text-xs text-foreground outline-none"
              >
                {ETAPAS.map((e) => (
                  <option key={e} value={e}>{ESTILO_ETAPA[e].texto}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { setTurnos([]); setErrorPrueba(null); }} className="text-xs text-muted hover:text-foreground">
              Reiniciar
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-xs text-muted">No le llega nada a ningún cliente. Usa lo que está escrito en el entrenamiento, aunque no lo hayas guardado.</p>

        <div className="mt-3 flex min-h-[320px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-background p-3">
          {turnos.length === 0 && <p className="m-auto text-center text-xs text-muted">Escribe como si fueras un cliente.</p>}
          {turnos.map((t, i) => (
            <div key={i} className={`max-w-[85%] ${t.role === "user" ? "self-end" : "self-start"}`}>
              <p className={`whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] ${t.role === "user" ? "bg-primary/15 text-foreground" : "bg-surface text-foreground"}`}>{t.content}</p>
              {t.nota && <p className="mt-1 text-[11px] text-muted">{t.nota}</p>}
            </div>
          ))}
          {probando && <p className="self-start text-xs text-muted">{nombre} está escribiendo…</p>}
          {errorPrueba && <p className="text-xs text-red-400">{errorPrueba}</p>}
        </div>

        <form onSubmit={enviarPrueba} className="mt-3 flex gap-2">
          <input
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            aria-label="Mensaje de prueba"
            placeholder="¿Cuánto cuesta?"
            className="min-w-0 flex-1 rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
          <button type="submit" disabled={probando || !mensaje.trim()} className="rounded-[9px] border border-border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-surface-hover disabled:opacity-50">
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
