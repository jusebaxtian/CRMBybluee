export type PagoDelCliente = {
  id: string;
  provider: string;
  amount_cents: number;
  currency: string;
  /** Cuándo se activó: la aprobación, o la creación si se aprobó sola. */
  fecha: string;
  proofUrl: string | null;
};

const dinero = (centavos: number, moneda: string) =>
  `$${(centavos / 100).toLocaleString("es-CO")}${moneda === "COP" ? "" : ` ${moneda}`}`;

/**
 * Los pagos que de verdad entraron de este cliente.
 *
 * Solo aprobados: los pendientes y rechazados no son plata recibida y
 * mezclados con los otros hacen dudar de cuánto pagó. Los pendientes se
 * revisan en la pantalla de Pagos, que es donde se aprueban.
 */
export function PagosDelCliente({ pagos }: { pagos: PagoDelCliente[] }) {
  // Cada moneda por separado: sumar COP con otra moneda daria un numero sin
  // sentido. Casi siempre hay una sola.
  const totales = new Map<string, number>();
  for (const p of pagos) totales.set(p.currency, (totales.get(p.currency) ?? 0) + Number(p.amount_cents));

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Pagos realizados</p>
        {pagos.length > 0 && (
          <p className="text-xs text-muted">
            {pagos.length} pago{pagos.length === 1 ? "" : "s"} · total{" "}
            <span className="font-medium text-foreground">
              {[...totales].map(([moneda, centavos]) => dinero(centavos, moneda)).join(" + ")}
            </span>
          </p>
        )}
      </div>

      {pagos.length === 0 ? (
        <p className="text-sm text-muted">Este cliente todavía no tiene pagos aprobados.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Monto</th>
                <th className="px-4 py-2 font-medium">Método</th>
                <th className="px-4 py-2 font-medium">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 text-foreground">
                    {new Date(p.fecha).toLocaleDateString("es-CO", {
                      timeZone: "America/Bogota",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 font-medium text-foreground">{dinero(Number(p.amount_cents), p.currency)}</td>
                  <td className="px-4 py-2 text-muted">{p.provider === "bold" ? "Bold" : "Transferencia"}</td>
                  <td className="px-4 py-2">
                    {p.proofUrl ? (
                      <a
                        href={p.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
