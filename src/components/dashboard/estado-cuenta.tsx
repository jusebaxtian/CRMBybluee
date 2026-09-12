import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarCuenta, type Cuenta } from "@/lib/dashboard/datos";

const ESTADO: Record<Cuenta["estado"], { etiqueta: string; texto: string; fondo: string; punto: string }> = {
  activo: { etiqueta: "ACTIVO", texto: "text-dash-green-text", fondo: "bg-dash-green-13", punto: "bg-dash-green" },
  por_vencer: { etiqueta: "POR VENCER", texto: "text-dash-amber", fondo: "bg-[rgba(251,191,36,0.13)]", punto: "bg-dash-amber" },
  vencido: { etiqueta: "VENCIDO", texto: "text-dash-red", fondo: "bg-[rgba(248,113,113,0.13)]", punto: "bg-dash-red" },
};

function fechaLarga(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

export async function EstadoCuenta() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const cuenta = await cargarCuenta(supabase, workspaceId);
  const e = ESTADO[cuenta.estado];

  const restantes = cuenta.diasRestantes;
  const consumidos = restantes !== null ? Math.max(0, cuenta.diasTotales - Math.max(0, restantes)) : 0;
  const pct = Math.min(100, Math.max(0, (consumidos / cuenta.diasTotales) * 100));

  return (
    <section
      aria-label="Estado de cuenta"
      className="flex flex-col gap-[14px] rounded-[13px] border border-dash-border bg-dash-card p-[18px]"
    >
      <header className="flex items-center justify-between">
        <span className="font-dash-ui text-[11.5px] font-semibold uppercase tracking-[.4px] text-dash-text-2">
          Estado de cuenta
        </span>
        <span className={`flex items-center gap-1.5 rounded-[20px] px-2 py-0.5 font-dash-ui text-[11px] font-bold ${e.fondo} ${e.texto}`}>
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${e.punto}`} />
          {e.etiqueta}
        </span>
      </header>

      <div>
        <p className="font-dash-ui text-[11.5px] text-dash-text-2">Plan contratado</p>
        <p className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-dash-text">{cuenta.plan}</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <p className="font-dash-ui text-[12.5px] font-semibold text-dash-text">
            {restantes === null
              ? "Sin fecha de renovación"
              : restantes < 0
                ? `Venció hace ${Math.abs(restantes)} ${Math.abs(restantes) === 1 ? "día" : "días"}`
                : `${restantes} ${restantes === 1 ? "día" : "días"} para la renovación`}
          </p>
          {restantes !== null && (
            <p className="font-dash-ui text-[11.5px] font-medium tabular-nums text-dash-text-3">
              {consumidos} / {cuenta.diasTotales}
            </p>
          )}
        </div>
        <div className="mt-2 h-[7px] overflow-hidden rounded-[4px] bg-dash-track" aria-hidden>
          <div
            className={`h-full rounded-[4px] transition-[width] duration-[400ms] ease-out ${e.punto}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {cuenta.fechaRenovacion && (
          <p className="mt-2 font-dash-ui text-[11.5px] text-dash-text-3">
            {restantes !== null && restantes < 0 ? "Venció el " : "Renueva el "}
            <span className="font-semibold text-dash-text">{fechaLarga(cuenta.fechaRenovacion)}</span>
          </p>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        <Link
          href="/dashboard/billing"
          className="flex-1 rounded-[10px] border border-dash-border bg-dash-surface-subtle p-[10px] text-center font-dash-ui text-[12.5px] font-semibold text-dash-text transition-colors duration-150 hover:bg-[rgba(255,255,255,0.09)]"
        >
          Ver facturación
        </Link>
        <Link
          href="/dashboard/billing?renovar=1"
          className="flex-1 rounded-[10px] bg-dash-green p-[10px] text-center font-dash-ui text-[12.5px] font-bold text-dash-on-green transition-colors duration-150 hover:bg-[#1fb355]"
        >
          Renovar ahora
        </Link>
      </div>
    </section>
  );
}
