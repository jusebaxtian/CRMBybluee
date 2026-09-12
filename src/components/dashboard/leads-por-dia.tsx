import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarLeadsPorDia, type RangoFechas } from "@/lib/dashboard/datos";

/**
 * Leads por dia: nuevos vs. los que llegaron desde un anuncio de Meta.
 *
 * El diseño decia "nuevos vs. interesados", pero "interesado" no esta
 * definido en el sistema (decision del 12 sep 2026: no definirlo ahora). Se
 * sustituye por Meta Ads, que si existe y es la comparacion que mas le
 * importa a quien paga pauta.
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
    <section aria-label="Leads por día" className="rounded-[13px] border border-dash-border bg-dash-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-dash-ui text-[15px] font-semibold text-dash-text">Leads por día</h2>
          <p className="font-dash-ui text-[12px] text-dash-text-2">Nuevos vs. de Meta Ads</p>
        </div>
        <ul className="flex gap-4 font-dash-ui text-[11.5px] font-medium text-dash-text-2">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-[2px] bg-dash-green" />
            Nuevos
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-[2px] bg-dash-green-28" />
            De Meta Ads
          </li>
        </ul>
      </header>

      {dias.length === 0 ? (
        <p className="flex h-[172px] items-center justify-center font-dash-ui text-[12.5px] text-dash-text-3">
          Sin contactos nuevos en este periodo
        </p>
      ) : (
        <div
          className="mt-4 flex h-[172px] items-end gap-[14px] max-[700px]:gap-[6px]"
          role="img"
          aria-label={`Contactos nuevos por día, ${dias.length} días`}
        >
          {dias.map((d, i) => (
            <div
              key={d.dia}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              title={`${d.dia}: ${d.nuevos} nuevos, ${d.metaAds} de Meta Ads`}
            >
              <div className="flex h-[150px] w-full items-end justify-center gap-[3px]">
                <div
                  className="w-full max-w-[22px] rounded-[5px_5px_2px_2px] bg-dash-green transition-[height] duration-[400ms] ease-out"
                  style={{ height: `${(d.nuevos / maximo) * 100}%`, minHeight: d.nuevos > 0 ? 3 : 0 }}
                />
                <div
                  className="w-full max-w-[22px] rounded-[5px_5px_2px_2px] bg-dash-green-28 transition-[height] duration-[400ms] ease-out"
                  style={{ height: `${(d.metaAds / maximo) * 100}%`, minHeight: d.metaAds > 0 ? 3 : 0 }}
                />
              </div>
              <span
                className={`truncate font-dash-ui text-[11px] ${
                  d.esHoy ? "font-semibold text-dash-green-text" : "font-medium text-[rgba(232,242,236,0.4)]"
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
