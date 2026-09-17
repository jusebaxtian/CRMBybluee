"use client";

import { useRef, useState } from "react";
import { AlarmClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { listarRecordatoriosEntre, type RecordatorioAgenda } from "@/app/actions/recordatorios";
import { FormularioRecordatorio } from "@/components/agenda/formulario-recordatorio";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function claveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function rangoDelMes(anio: number, mes: number) {
  // Rejilla de semanas completas (lunes a domingo) que cubre el mes.
  const primero = new Date(anio, mes, 1);
  const inicio = new Date(primero);
  inicio.setDate(primero.getDate() - ((primero.getDay() + 6) % 7));
  const ultimo = new Date(anio, mes + 1, 0);
  const fin = new Date(ultimo);
  fin.setDate(ultimo.getDate() + (7 - ((ultimo.getDay() + 6) % 7) - 1));
  const dias: Date[] = [];
  for (const d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) dias.push(new Date(d));
  return { inicio, finExclusivo: new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1), dias };
}

/**
 * Agenda del espacio: calendario mensual con los recordatorios de todos los
 * contactos. Clic en uno para editarlo; "+" en un dia o el boton para crear
 * buscando el contacto.
 */
export function Agenda({ inicial, mesInicial }: { inicial: RecordatorioAgenda[]; mesInicial: string }) {
  const [anio, mes] = mesInicial.split("-").map(Number);
  const [cursor, setCursor] = useState({ anio, mes: mes - 1 });
  const [items, setItems] = useState<RecordatorioAgenda[]>(inicial);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<RecordatorioAgenda | null>(null);
  const [nuevoEn, setNuevoEn] = useState<Date | null>(null);
  const pedido = useRef(0);

  const { dias } = rangoDelMes(cursor.anio, cursor.mes);

  // Se carga desde los manejadores (cambio de mes, guardar), no en un efecto.
  function cargar(anio: number, mes: number) {
    const n = ++pedido.current;
    const { inicio, finExclusivo } = rangoDelMes(anio, mes);
    setCargando(true);
    listarRecordatoriosEntre(inicio.toISOString(), finExclusivo.toISOString()).then((r) => {
      if (n !== pedido.current) return;
      setItems(r);
      setCargando(false);
    });
  }

  const porDia = new Map<string, RecordatorioAgenda[]>();
  for (const r of items) {
    const k = claveDia(new Date(r.recordar_en));
    porDia.set(k, [...(porDia.get(k) ?? []), r]);
  }
  const hoy = claveDia(new Date());
  const titulo = new Date(cursor.anio, cursor.mes, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  function irA(anio: number, mes: number) {
    setCursor({ anio, mes });
    cargar(anio, mes);
  }

  function mover(delta: number) {
    const d = new Date(cursor.anio, cursor.mes + delta, 1);
    irA(d.getFullYear(), d.getMonth());
  }

  function guardado() {
    setEditando(null);
    setNuevoEn(null);
    cargar(cursor.anio, cursor.mes);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <p className="min-w-40 text-center text-sm font-semibold capitalize text-foreground">{titulo}</p>
          <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground">
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              irA(d.getFullYear(), d.getMonth());
            }}
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-foreground"
          >
            Hoy
          </button>
          {cargando && <span className="text-xs text-muted">Cargando…</span>}
        </div>
        <button
          type="button"
          onClick={() => setNuevoEn(new Date(Date.now() + 60 * 60 * 1000))}
          className="flex items-center gap-2 rounded-[10px] bg-primary px-4 py-[10px] text-[12.5px] font-bold text-white hover:bg-primary-hover"
        >
          <Plus size={16} />
          Nuevo recordatorio
        </button>
      </div>

      <div className="overflow-hidden rounded-[13px] border border-border bg-surface">
        <div className="grid grid-cols-7 border-b border-border">
          {DIAS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((d) => {
            const k = claveDia(d);
            const delMes = d.getMonth() === cursor.mes;
            const lista = porDia.get(k) ?? [];
            return (
              <div
                key={k}
                className={`group relative min-h-24 border-b border-r border-border p-1.5 sm:min-h-28 ${delMes ? "" : "bg-background/40"}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      k === hoy ? "bg-primary font-bold text-white" : delMes ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNuevoEn(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0))}
                    title="Nuevo recordatorio este día"
                    className="hidden h-5 w-5 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-foreground group-hover:flex"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <ul className="flex flex-col gap-1">
                  {lista.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setEditando(r)}
                        title={`${r.contacto}: ${r.texto}`}
                        className="flex w-full items-start gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-1 text-left text-[11px] leading-tight text-foreground hover:bg-primary/20"
                      >
                        <AlarmClock size={10} className="mt-0.5 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="font-semibold">
                            {new Date(r.recordar_en).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                          </span>{" "}
                          <span className="text-muted">{r.contacto}</span>
                          <span className="block truncate">{r.texto}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {editando && <FormularioRecordatorio existente={editando} onClose={() => setEditando(null)} onGuardado={guardado} />}
      {nuevoEn && <FormularioRecordatorio fechaInicial={nuevoEn} onClose={() => setNuevoEn(null)} onGuardado={guardado} />}
    </div>
  );
}
