"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Hoy / 7 dias / 30 dias / rango de fechas.
 *
 * El periodo vive en la URL (?periodo=7d o ?desde=&hasta=), no en estado
 * local: asi la pagina, que es un componente de servidor, recalcula todos los
 * bloques con el mismo rango, y el enlace se puede compartir o recargar sin
 * perder la seleccion. Es el mismo mecanismo que ya usa la tabla de
 * etiquetas (tagsFrom / tagsTo).
 */
const OPCIONES = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "7d", etiqueta: "7 días" },
  { valor: "30d", etiqueta: "30 días" },
] as const;

export function PeriodoSelector({
  activo,
  desde,
  hasta,
}: {
  activo: "hoy" | "7d" | "30d" | "rango";
  desde: string | null;
  hasta: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [mostrarFechas, setMostrarFechas] = useState(activo === "rango");
  const [d, setD] = useState(desde ?? "");
  const [h, setH] = useState(hasta ?? "");

  function ir(cambios: Record<string, string | null>) {
    const siguiente = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) siguiente.delete(k);
      else siguiente.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${siguiente.toString()}`));
  }

  const base = "rounded-[7px] px-3 py-1.5 font-dash-ui text-[12.5px] font-semibold transition-colors duration-150";
  const inactivo = `${base} text-dash-text-2 hover:text-dash-text`;
  const seleccionado = `${base} bg-dash-green text-dash-on-green`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Periodo"
        className="flex gap-0.5 rounded-[9px] border border-dash-border bg-dash-card p-[3px]"
      >
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo === o.valor}
            className={activo === o.valor ? seleccionado : inactivo}
            onClick={() => {
              setMostrarFechas(false);
              ir({ periodo: o.valor, desde: null, hasta: null });
            }}
          >
            {o.etiqueta}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={activo === "rango"}
          className={activo === "rango" ? seleccionado : inactivo}
          onClick={() => setMostrarFechas((v) => !v)}
        >
          Fechas
        </button>
      </div>

      {mostrarFechas && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (d && h) ir({ periodo: null, desde: d, hasta: h });
          }}
        >
          <input
            type="date"
            aria-label="Desde"
            value={d}
            max={h || undefined}
            onChange={(e) => setD(e.target.value)}
            className="rounded-[9px] border border-dash-border bg-dash-card px-2 py-1.5 font-dash-ui text-[12px] text-dash-text [color-scheme:dark]"
          />
          <span className="text-[12px] text-dash-text-3">a</span>
          <input
            type="date"
            aria-label="Hasta"
            value={h}
            min={d || undefined}
            onChange={(e) => setH(e.target.value)}
            className="rounded-[9px] border border-dash-border bg-dash-card px-2 py-1.5 font-dash-ui text-[12px] text-dash-text [color-scheme:dark]"
          />
          <button
            type="submit"
            disabled={!d || !h}
            className="rounded-[9px] bg-dash-green px-3 py-1.5 font-dash-ui text-[12px] font-bold text-dash-on-green disabled:opacity-40"
          >
            Aplicar
          </button>
        </form>
      )}
    </div>
  );
}
