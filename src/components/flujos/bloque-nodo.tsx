"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Bot, Flag, MessageSquare, MousePointerClick, Play, Timer } from "lucide-react";
import { BLOQUES, resumenDe, salidasDe, type DatosBloque, type TipoBloque } from "@/lib/flujos/bloques";

const ICONOS = {
  inicio: Play,
  mensaje: MessageSquare,
  botones: MousePointerClick,
  esperar: Timer,
  ia: Bot,
  fin: Flag,
} as const;

export type DatosNodo = { tipo: TipoBloque; datos: DatosBloque; conAviso?: boolean };

/**
 * Un bloque dibujado en el lienzo.
 *
 * Las salidas se pintan como puntos a la derecha, una por camino posible, con
 * su etiqueta al lado: es lo que permite ver de un vistazo que pasa si el
 * cliente toca "Sí" y que pasa si no contesta.
 */
export function BloqueNodo({ data, selected }: NodeProps) {
  const { tipo, datos, conAviso } = data as unknown as DatosNodo;
  const def = BLOQUES[tipo];
  const Icono = ICONOS[tipo];
  const salidas = salidasDe(tipo, datos);

  return (
    <div
      className={`w-[230px] rounded-[12px] border-2 bg-surface shadow-lg transition-colors ${
        selected ? "border-primary" : conAviso ? "border-warning/70" : "border-border"
      }`}
    >
      {def.aceptaEntrada && (
        <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-border !bg-background" />
      )}

      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: `color-mix(in srgb, ${def.color} 18%, transparent)`, color: def.color }}
        >
          <Icono size={13} />
        </span>
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">{def.nombre}</p>
        {conAviso && <span className="shrink-0 text-[11px] text-warning">!</span>}
      </div>

      <p className="line-clamp-3 px-3 py-2 text-[11.5px] leading-relaxed text-muted">{resumenDe(tipo, datos)}</p>

      {tipo === "botones" && (datos.botones ?? []).length > 0 && (
        <div className="flex flex-col gap-1 px-3 pb-2">
          {(datos.botones ?? []).slice(0, 3).map((b, i) => (
            <span
              key={i}
              className="truncate rounded-md border border-border bg-background px-2 py-1 text-center text-[11px] text-foreground"
            >
              {b.trim() || `Botón ${i + 1}`}
            </span>
          ))}
        </div>
      )}

      {salidas.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
          {salidas.map((s, i) => (
            <div key={s.id} className="relative flex h-4 items-center justify-end">
              {s.etiqueta && <span className="pr-3 text-[10.5px] text-muted">{s.etiqueta}</span>}
              <Handle
                id={s.id}
                type="source"
                position={Position.Right}
                style={{ top: "50%", right: -18 }}
                className="!h-3 !w-3 !border-2 !border-border !bg-background"
              />
              {/* El punto de cada salida se alinea con su etiqueta: si todos
                  colgaran del mismo borde no se sabria cual linea es cual. */}
              <span className="sr-only">{`salida ${i + 1}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
