import { NOMBRE_CANAL, NOMBRE_METODO, type EstadoBold } from "@/lib/bold-pagos";

export type FilaPagoBold = {
  clave: string;
  fecha: string;
  producto: string;
  tipo: "plan" | "curso" | "link" | "otro";
  quien: string | null;
  metodo: string | null;
  canal: string | null;
  monto: number | null;
  currency: string | null;
  estado: EstadoBold;
  referencia: string | null;
};

const ESTILO_ESTADO: Record<EstadoBold, { texto: string; clase: string }> = {
  aprobado: { texto: "Aprobado", clase: "text-success border-success" },
  rechazado: { texto: "Rechazado", clase: "text-red-400 border-red-400" },
  anulado: { texto: "Anulado", clase: "text-muted border-border" },
  anulacion_rechazada: { texto: "Aprobado", clase: "text-success border-success" },
};

const ESTILO_TIPO: Record<FilaPagoBold["tipo"], string> = {
  plan: "border-primary/40 bg-primary/10 text-primary",
  curso: "border-warning/40 bg-warning/10 text-warning",
  link: "border-success/40 bg-success/10 text-success",
  otro: "border-border bg-background text-muted",
};

const pesos = (n: number) => `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

/** Todos los pagos en linea por Bold, de cualquier producto (0180). */
export function PagosBold({ filas }: { filas: FilaPagoBold[] }) {
  const aprobados = filas.filter((f) => f.estado === "aprobado" || f.estado === "anulacion_rechazada");
  const total = aprobados.reduce((s, f) => s + (f.monto ?? 0), 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pagos en línea por Bold</h2>
          <p className="text-sm text-muted">
            Todo lo que entra por Bold: planes, cursos, links de pago, PSE, Nequi y QR, sea del producto que sea.
          </p>
        </div>
        <p className="text-sm text-muted">
          {aprobados.length} aprobado{aprobados.length === 1 ? "" : "s"} · <span className="font-semibold text-foreground">{pesos(total)}</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Producto</th>
              <th className="px-5 py-3 font-medium">Quién pagó</th>
              <th className="px-5 py-3 font-medium">Medio</th>
              <th className="px-5 py-3 font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const d = new Date(f.fecha);
              const estado = ESTILO_ESTADO[f.estado];
              return (
                <tr key={f.clave} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <p className="text-foreground">
                      {d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted">
                      {d.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${ESTILO_TIPO[f.tipo]}`}>
                      {f.tipo === "plan" ? "Plan" : f.tipo === "curso" ? "Curso" : f.tipo === "link" ? "Link" : "Otro"}
                    </span>
                    <p className="mt-1 text-foreground">{f.producto}</p>
                    {f.referencia && <p className="max-w-[220px] truncate text-xs text-muted" title={f.referencia}>Ref: {f.referencia}</p>}
                  </td>
                  <td className="px-5 py-3 text-foreground">{f.quien ?? "—"}</td>
                  <td className="px-5 py-3">
                    <p className="text-foreground">{f.metodo ? (NOMBRE_METODO[f.metodo] ?? f.metodo) : "—"}</p>
                    {f.canal && <p className="text-xs text-muted">{NOMBRE_CANAL[f.canal] ?? f.canal}</p>}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-foreground">
                    {f.monto !== null ? pesos(f.monto) : "—"}
                    {f.currency && f.currency !== "COP" && <span className="ml-1 text-xs text-muted">{f.currency}</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${estado.clase}`}>{estado.texto}</span>
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-muted">
                  Todavía no hay pagos de Bold. Aparecen aquí apenas Bold los avisa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
