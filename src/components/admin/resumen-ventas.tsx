import { CalendarRange, TrendingUp } from "lucide-react";

export type VentaFila = { amount_cents: number; fecha: string };

const ZONA = "America/Bogota";

/** Dia "YYYY-MM-DD" en hora de Colombia. */
export function diaCo(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA });
}

function pesos(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function Tarjeta({
  titulo,
  ventas,
  destacada = false,
}: {
  titulo: string;
  ventas: VentaFila[];
  destacada?: boolean;
}) {
  const total = ventas.reduce((s, v) => s + v.amount_cents, 0);
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border p-4 ${
        destacada ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{titulo}</p>
      <p className="font-dash-display text-[26px] font-bold leading-none text-foreground">
        {ventas.length}
        <span className="ml-1.5 text-[13px] font-medium text-muted">
          {ventas.length === 1 ? "venta" : "ventas"}
        </span>
      </p>
      <p className="text-sm font-semibold text-success">{pesos(total)}</p>
    </div>
  );
}

/**
 * Ventas aprobadas: hoy, esta semana, este mes y, si se pidió, un rango de
 * fechas. La "fecha de venta" es cuando se activó el pago (se aprobó).
 */
export function ResumenVentas({
  ventas,
  desde,
  hasta,
}: {
  ventas: VentaFila[];
  desde?: string | null;
  hasta?: string | null;
}) {
  const ahora = new Date();
  const hoy = diaCo(ahora);

  // Lunes de esta semana: se calcula sobre el dia de Colombia, al mediodia
  // UTC, para que el cambio de dia no lo corra.
  const [anio, mesNum, diaNum] = hoy.split("-").map(Number);
  const mediodia = new Date(Date.UTC(anio, mesNum - 1, diaNum, 12));
  const desdeLunes = (mediodia.getUTCDay() + 6) % 7; // lunes = 0
  const lunes = new Date(mediodia.getTime() - desdeLunes * 86_400_000).toISOString().slice(0, 10);
  const mes = hoy.slice(0, 7);

  const deHoy = ventas.filter((v) => diaCo(v.fecha) === hoy);
  const deLaSemana = ventas.filter((v) => diaCo(v.fecha) >= lunes);
  const delMes = ventas.filter((v) => diaCo(v.fecha).startsWith(mes));
  const delRango =
    desde || hasta
      ? ventas.filter((v) => {
          const d = diaCo(v.fecha);
          return (!desde || d >= desde) && (!hasta || d <= hasta);
        })
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Ventas activadas</h2>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${delRango ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Tarjeta titulo="Hoy" ventas={deHoy} destacada />
        <Tarjeta titulo="Esta semana" ventas={deLaSemana} />
        <Tarjeta titulo="Este mes" ventas={delMes} />
        {delRango && <Tarjeta titulo="Rango elegido" ventas={delRango} />}
      </div>

      {/* Filtro por fechas: form normal, sin JavaScript. */}
      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <CalendarRange size={14} />
          Por fechas
        </div>
        <label className="text-xs text-muted">
          Desde
          <input
            type="date"
            name="desde"
            defaultValue={desde ?? ""}
            className="mt-0.5 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs text-muted">
          Hasta
          <input
            type="date"
            name="hasta"
            defaultValue={hasta ?? ""}
            className="mt-0.5 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Ver
        </button>
        {(desde || hasta) && (
          <a href="/admin/payments" className="px-2 py-1.5 text-sm text-muted hover:text-foreground">
            Limpiar
          </a>
        )}
      </form>
    </div>
  );
}
