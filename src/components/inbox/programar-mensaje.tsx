"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import {
  cancelarMensajeProgramado,
  descartarMensajeFallido,
  listarMensajesProgramados,
  programarMensaje,
  type MensajeProgramado,
} from "@/app/actions/mensajes-programados";
import { windowExpiresAt } from "@/lib/whatsapp/message-window";

export type PlantillaParaProgramar = { id: string; meta_template_name: string; body_text: string | null };

const INPUT =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";

function aLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Programar un mensaje para este chat (migracion 0177). El mensaje libre sale si
 * a esa hora la ventana de 24 h sigue abierta; si no, sale la plantilla.
 */
export function ProgramarMensajePanel({
  conversationId,
  contactName,
  plantillas,
  lastInboundAt,
  onClose,
}: {
  conversationId: string;
  contactName: string;
  plantillas: PlantillaParaProgramar[];
  lastInboundAt: string | null;
  onClose: () => void;
}) {
  const [cuando, setCuando] = useState(() => aLocal(new Date(Date.now() + 60 * 60 * 1000)));
  const [tipo, setTipo] = useState<"libre" | "plantilla">("libre");
  const [texto, setTexto] = useState("");
  const [plantillaId, setPlantillaId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [pending, startTransition] = useTransition();
  const [programados, setProgramados] = useState<MensajeProgramado[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    listarMensajesProgramados(conversationId).then(setProgramados);
  }, [conversationId]);

  // A la hora elegida, ¿seguira abierta la ventana con lo que se sabe hoy?
  const cierra = windowExpiresAt(lastInboundAt);
  const fecha = new Date(cuando);
  const cerradaParaEsaHora = !cierra || Number.isNaN(fecha.getTime()) || cierra.getTime() <= fecha.getTime();
  const faltaRespaldo = tipo === "libre" && cerradaParaEsaHora && !plantillaId;
  const nombreDe = new Map(plantillas.map((p) => [p.id, p.meta_template_name]));

  function editar(m: MensajeProgramado) {
    setEditandoId(m.id);
    setCuando(aLocal(new Date(m.enviar_en)));
    setTipo(m.texto ? "libre" : "plantilla");
    setTexto(m.texto ?? "");
    setPlantillaId(m.template_id ?? "");
    setError(null);
  }

  function limpiar() {
    setEditandoId(null);
    setTexto("");
    setPlantillaId("");
    setCuando(aLocal(new Date(Date.now() + 60 * 60 * 1000)));
  }

  function guardar() {
    setError(null);
    startTransition(async () => {
      const r = await programarMensaje({
        id: editandoId,
        conversationId,
        enviarEn: new Date(cuando).toISOString(),
        texto: tipo === "libre" ? texto : null,
        templateId: plantillaId || null,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setListo(true);
      listarMensajesProgramados(conversationId).then(setProgramados);
      setTimeout(() => {
        setListo(false);
        limpiar();
      }, 1500);
    });
  }

  function quitar(m: MensajeProgramado) {
    startTransition(async () => {
      const r = m.estado === "fallido" ? await descartarMensajeFallido(m.id) : await cancelarMensajeProgramado(m.id);
      if ("error" in r) setError(r.error);
      if (editandoId === m.id) limpiar();
      listarMensajesProgramados(conversationId).then(setProgramados);
    });
  }

  const puedeGuardar = !pending && (tipo === "libre" ? !!texto.trim() && !faltaRespaldo : !!plantillaId);

  return (
    <div className="absolute left-full top-1/2 z-20 ml-2 max-h-[80vh] w-80 max-w-[calc(100vw-5rem)] -translate-y-1/2 overflow-y-auto rounded-[13px] border border-border bg-surface p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">Programar mensaje · {contactName}</p>
        <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>

      {listo ? (
        <p className="flex items-center gap-2 py-2 text-sm text-success">
          <Check size={15} /> {editandoId ? "Cambios guardados" : "Mensaje programado"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">
            ¿Cuándo?
            <input type="datetime-local" value={cuando} min={aLocal(new Date())} onChange={(e) => setCuando(e.target.value)} className={`${INPUT} mt-1`} />
          </label>

          <div className="grid grid-cols-2 gap-1 rounded-[9px] bg-background p-1 text-xs font-medium" role="tablist">
            {(["libre", "plantilla"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tipo === t}
                onClick={() => {
                  setTipo(t);
                  setError(null);
                }}
                className={`rounded-[7px] px-2 py-1.5 ${tipo === t ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {t === "libre" ? "Mensaje libre" : "Plantilla"}
              </button>
            ))}
          </div>

          {tipo === "libre" && (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={4096}
              rows={4}
              placeholder="Escribe el mensaje"
              className={`${INPUT} resize-none`}
              autoFocus
            />
          )}

          {plantillas.length === 0 ? (
            <p className="text-xs text-muted">No tienes plantillas aprobadas para esta línea. Créalas en Campañas → Plantillas.</p>
          ) : (
            <label className="text-xs font-medium text-muted">
              {tipo === "libre" ? "Plantilla de respaldo" : "Plantilla"}
              <select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)} className={`${INPUT} mt-1`}>
                <option value="">{tipo === "libre" ? (cerradaParaEsaHora ? "Elige una plantilla" : "Sin respaldo") : "Elige una plantilla"}</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.meta_template_name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {tipo === "libre" && (
            <p className={`text-[11px] ${faltaRespaldo ? "text-warning" : "text-muted"}`}>
              {cerradaParaEsaHora
                ? "A esa hora la ventana de 24 h estará cerrada: saldrá la plantilla, salvo que el cliente escriba antes."
                : "Sale el mensaje libre. Si la ventana de 24 h ya cerró a esa hora, sale la plantilla de respaldo."}
            </p>
          )}

          {error && <p className="text-xs text-error">{error}</p>}
          <button
            type="button"
            onClick={guardar}
            disabled={!puedeGuardar}
            className="flex items-center justify-center gap-2 rounded-[9px] bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {editandoId ? "Guardar cambios" : "Programar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limpiar} className="text-xs text-muted hover:text-foreground">
              Cancelar edición
            </button>
          )}
        </div>
      )}

      {programados.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2">
          <li className="text-[11px] font-medium uppercase tracking-wide text-muted">Programados en este chat</li>
          {programados.map((m) => (
            <li
              key={m.id}
              className={`flex items-start gap-2 rounded-[8px] px-1.5 py-1 text-xs ${editandoId === m.id ? "bg-primary/10" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className={m.estado === "fallido" ? "text-error" : "text-muted"}>
                  {m.estado === "fallido" && <AlertCircle size={11} className="mr-1 inline" />}
                  {fechaCorta(m.enviar_en)}
                  {m.estado === "fallido" ? " · No se envió" : m.estado === "enviando" ? " · Enviando…" : ""}
                </p>
                <p className="truncate text-foreground">
                  {m.texto ?? `Plantilla: ${nombreDe.get(m.template_id ?? "") ?? "—"}`}
                </p>
                {m.texto && m.template_id && (
                  <p className="truncate text-[11px] text-muted">Respaldo: {nombreDe.get(m.template_id) ?? "plantilla"}</p>
                )}
                {m.estado === "fallido" && m.error && <p className="text-[11px] text-error">{m.error}</p>}
              </div>
              {m.estado === "pendiente" && (
                <button
                  type="button"
                  onClick={() => editar(m)}
                  disabled={pending}
                  title="Editar"
                  aria-label="Editar mensaje programado"
                  className="mt-0.5 text-muted hover:text-foreground"
                >
                  <Pencil size={13} />
                </button>
              )}
              {m.estado !== "enviando" && (
                <button
                  type="button"
                  onClick={() => quitar(m)}
                  disabled={pending}
                  title={m.estado === "fallido" ? "Quitar de la lista" : "Eliminar"}
                  aria-label={m.estado === "fallido" ? "Quitar de la lista" : "Eliminar mensaje programado"}
                  className="mt-0.5 text-muted hover:text-error"
                >
                  {m.estado === "fallido" ? <X size={13} /> : <Trash2 size={13} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
