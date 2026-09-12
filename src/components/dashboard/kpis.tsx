import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarKpis, type RangoFechas } from "@/lib/dashboard/datos";

export const REJILLA_KPIS =
  "grid grid-cols-[repeat(4,minmax(0,1fr))] gap-4 max-[1100px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[700px]:grid-cols-[minmax(0,1fr)]";

function formatoTiempo(seg: number | null): string {
  if (seg === null) return "—";
  if (seg < 60) return `${Math.round(seg)}s`;
  const m = Math.floor(seg / 60);
  if (m < 60) return `${m}m ${Math.round(seg % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** "+21%" en verde o "-38%" en rojo; `mejorSiBaja` invierte el color (tiempo de respuesta). */
function Delta({ pct, mejorSiBaja = false, sufijo }: { pct: number | null; mejorSiBaja?: boolean; sufijo: string }) {
  if (pct === null) return null;
  const positivoEsBueno = mejorSiBaja ? pct <= 0 : pct >= 0;
  return (
    <span className={`font-dash-ui text-[12px] font-semibold ${positivoEsBueno ? "text-dash-green-text" : "text-dash-red"}`}>
      {pct > 0 ? "+" : ""}
      {pct}% {sufijo}
    </span>
  );
}

function Tarjeta({
  etiqueta,
  cifra,
  delta,
  pie,
}: {
  etiqueta: string;
  cifra: string;
  delta?: React.ReactNode;
  pie: React.ReactNode;
}) {
  return (
    <article className="rounded-[13px] border border-dash-border bg-dash-card p-[18px]">
      <p className="font-dash-ui text-[11.5px] font-semibold uppercase tracking-[.4px] text-dash-text-2">{etiqueta}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-dash-display text-[34px] font-bold leading-none tabular-nums text-dash-text">{cifra}</p>
        {delta}
      </div>
      <p className="mt-2 font-dash-ui text-[12px] font-medium text-dash-text-3">{pie}</p>
    </article>
  );
}

export async function Kpis({ rango, etiquetaPeriodo }: { rango: RangoFechas; etiquetaPeriodo: string }) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const k = await cargarKpis(supabase, workspaceId, rango);
  const n = (v: number) => v.toLocaleString("es-CO");

  return (
    <div className={REJILLA_KPIS}>
      <Tarjeta
        etiqueta="Sin responder"
        cifra={n(k.sinResponder)}
        pie={
          k.sinResponder > 0 ? (
            <Link href="/dashboard/inbox?filtro=no-leidos" className="text-dash-green-text hover:underline">
              Responder ahora →
            </Link>
          ) : (
            "Todo respondido 🎉"
          )
        }
      />
      <Tarjeta
        etiqueta="Tiempo de respuesta"
        cifra={formatoTiempo(k.tiempoRespuestaSeg)}
        pie={
          k.deltaTiempoPct !== null ? (
            <Delta pct={k.deltaTiempoPct} mejorSiBaja sufijo={`que ${etiquetaPeriodo}`} />
          ) : (
            "Sin datos del periodo anterior"
          )
        }
      />
      <Tarjeta
        etiqueta="Contactos nuevos"
        cifra={n(k.contactosNuevos)}
        delta={<Delta pct={k.deltaContactosPct} sufijo="" />}
        pie={`${n(k.contactosMetaAds)} ${k.contactosMetaAds === 1 ? "vino" : "vinieron"} de Meta Ads`}
      />
      <Tarjeta
        etiqueta="Mensajes enviados"
        cifra={n(k.mensajesEnviados)}
        delta={<Delta pct={k.deltaEnviadosPct} sufijo="" />}
        pie={`vs. ${etiquetaPeriodo}`}
      />
    </div>
  );
}
