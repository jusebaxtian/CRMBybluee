import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarLeadsPorDia, type RangoFechas } from "@/lib/dashboard/datos";

/**
 * Contactos creados por dia. Una sola serie.
 *
 * El diseño traia "leads: nuevos vs. interesados" y luego se probo "nuevos
 * vs. de Meta Ads". Sebastian lo corrigio el 12 sep 2026: son contactos
 * creados, no leads, y no se comparan contra nada. Sin leyenda.
 */
export async function LeadsPorDia({ rango }: { rango: RangoFechas }) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const dias = await cargarLeadsPorDia(supabase, workspaceId, rango);
  const maximo = Math.max(1, ...dias.map((d) => d.nuevos));
  // Con mas de 14 dias la etiqueta de cada columna no cabe; se muestra una
  // de cada N para que sigan leyendose.
  const cadaN = dias.length > 14 ? Math.ceil(dias.length / 10) : 1;

  return (
    <section aria-label="Contactos creados por día" className="flex flex-col rounded-[13px] border border-dash-border bg-dash-card p-5">
      <header>
        <h2 className="font-dash-ui text-[15px] font-semibold text-dash-text">Contactos creados por día</h2>
        <p className="font-dash-ui text-[12px] text-dash-text-2">Últimos 7 días</p>
      </header>

      {dias.length === 0 ? (
        <p className="flex min-h-[172px] flex-1 items-center justify-center font-dash-ui text-[12.5px] text-dash-text-3">
          Sin contactos nuevos en este periodo
        </p>
      ) : (
        <div
          className="mt-4 flex min-h-[172px] flex-1 items-end gap-[14px] max-[700px]:gap-[6px]"
          role="img"
          aria-label={`Contactos creados por día, ${dias.length} días`}
        >
          {dias.map((d, i) => (
            <div
              key={d.dia}
              className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
              title={`${d.dia}: ${d.nuevos} ${d.nuevos === 1 ? "contacto" : "contactos"}`}
            >
              {/* La pista ocupa toda la altura disponible de la tarjeta, no
                  150px fijos: en la fila junto a Pendientes quedaba medio
                  vacia. */}
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className="w-full max-w-[34px] rounded-[5px_5px_2px_2px] bg-dash-green transition-[height] duration-[400ms] ease-out"
                  style={{ height: `${(d.nuevos / maximo) * 100}%`, minHeight: d.nuevos > 0 ? 3 : 0 }}
                />
              </div>
              <span className="font-dash-ui text-[11px] font-semibold tabular-nums text-dash-text">{d.nuevos}</span>
              <span
                className={`truncate font-dash-ui text-[11px] ${
                  d.esHoy ? "font-semibold text-dash-green-text" : "font-medium text-[var(--muted)]"
                } ${i % cadaN !== 0 && !d.esHoy ? "invisible" : ""}`}
              >
                {d.etiqueta}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
