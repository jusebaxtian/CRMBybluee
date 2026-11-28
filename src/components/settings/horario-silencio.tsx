"use client";

import { useState, useTransition } from "react";
import { MoonStar } from "lucide-react";
import { guardarHorarioDeSilencio } from "@/app/actions/silencio";

/**
 * Configuracion -> WhatsApp: horario de silencio (0192). En ese horario el CRM
 * no envia nada por su cuenta (seguimientos, pasos con espera, flujos con espera
 * y campanas de texto). Lo retoma al terminar si la ventana de 24 h sigue
 * abierta. Las plantillas, lo manual y las respuestas a quien esta escribiendo
 * salen normal.
 */
export function HorarioSilencio({ inicial }: { inicial: { activo: boolean; inicio: string; fin: string } }) {
  const [activo, setActivo] = useState(inicial.activo);
  const [inicio, setInicio] = useState(inicial.inicio);
  const [fin, setFin] = useState(inicial.fin);
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(null);
  const [guardando, startTransition] = useTransition();

  function guardar(nuevoActivo = activo) {
    setAviso(null);
    startTransition(async () => {
      const r = await guardarHorarioDeSilencio({ activo: nuevoActivo, inicio, fin });
      if ("error" in r) {
        setAviso({ error: true, texto: r.error ?? "No se pudo guardar." });
        return;
      }
      setActivo(nuevoActivo);
      setAviso({ error: false, texto: nuevoActivo ? `Activo: de ${inicio} a ${fin} (hora de Colombia).` : "Horario de silencio apagado." });
    });
  }

  const campo =
    "w-[120px] rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";

  return (
    <div className="rounded-[13px] border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MoonStar size={18} className="text-primary" /> Horario de silencio
          </h2>
          <p className="mt-1 max-w-[62ch] text-xs leading-relaxed text-muted">
            En este horario el CRM no envía nada por su cuenta: seguimientos, pasos con espera de las automatizaciones, esperas de
            los flujos y campañas de texto. Lo retoma al terminar el silencio, siempre que la ventana de 24 horas de WhatsApp siga
            abierta. Las <b className="text-foreground">plantillas</b>, lo que envía una persona y las respuestas a un cliente que
            está escribiendo (incluida la IA) salen normal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => guardar(!activo)}
          disabled={guardando}
          aria-pressed={activo}
          aria-label={activo ? "Apagar horario de silencio" : "Encender horario de silencio"}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${activo ? "border-primary bg-primary" : "border-border bg-surface-hover"}`}
        >
          <span className={`absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${activo ? "translate-x-[18px]" : "translate-x-0"}`} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted">
          Desde
          <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className={`${campo} mt-1 block`} />
        </label>
        <label className="text-xs font-medium text-muted">
          Hasta
          <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} className={`${campo} mt-1 block`} />
        </label>
        <button
          type="button"
          onClick={() => guardar()}
          disabled={guardando}
          className="rounded-[9px] border border-border px-4 py-2 text-[13px] font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar horario"}
        </button>
        <span className="pb-2 text-[11px] text-muted">Hora de Colombia. Puede cruzar la medianoche (ej. 22:00 a 05:00).</span>
      </div>
      {aviso && <p className={`mt-3 text-xs ${aviso.error ? "text-red-400" : "text-success"}`}>{aviso.texto}</p>}
    </div>
  );
}
