import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarResumen, type RangoFechas } from "@/lib/dashboard/datos";

const TARJETA = "rounded-[13px] border border-dash-border bg-dash-card p-[18px]";
const TITULO = "mb-[14px] font-dash-ui text-[14px] font-semibold text-dash-text";

function Barra({ etiqueta, valor, maximo, color }: { etiqueta: string; valor: number; maximo: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-dash-ui text-[12px] font-medium text-dash-text-2">{etiqueta}</span>
        <span className="font-dash-ui text-[12px] font-semibold tabular-nums text-dash-text">{valor.toLocaleString("es-CO")}</span>
      </div>
      <div className="mt-1.5 h-[6px] overflow-hidden rounded-[3px] bg-dash-track" aria-hidden>
        <div
          className={`h-full rounded-[3px] transition-[width] duration-[400ms] ease-out ${color}`}
          style={{ width: `${(valor / maximo) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Punto({ estado }: { estado: "ok" | "aviso" | "mal" }) {
  const color = estado === "ok" ? "bg-dash-green" : estado === "aviso" ? "bg-dash-amber" : "bg-dash-red";
  return <span aria-hidden className={`h-[7px] w-[7px] shrink-0 rounded-full ${color}`} />;
}

export async function Resumen({ rango }: { rango: RangoFechas }) {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const r = await cargarResumen(supabase, workspaceId, rango);
  const n = (v: number) => v.toLocaleString("es-CO");
  const maxMsg = Math.max(1, r.mensajes.enviados, r.mensajes.recibidos);

  return (
    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 max-[1100px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[700px]:grid-cols-[minmax(0,1fr)]">
      <section aria-label="Mensajes" className={TARJETA}>
        <h2 className={TITULO}>Mensajes</h2>
        <div className="flex flex-col gap-3">
          <Barra etiqueta="Enviados" valor={r.mensajes.enviados} maximo={maxMsg} color="bg-dash-green" />
          <Barra etiqueta="Recibidos" valor={r.mensajes.recibidos} maximo={maxMsg} color="bg-[rgba(27,168,74,0.45)]" />
        </div>
      </section>

      <section aria-label="Seguimientos" className={TARJETA}>
        <h2 className={TITULO}>Seguimientos</h2>
        <div className="flex items-center gap-4">
          <div>
            <p className="font-dash-display text-[28px] font-bold leading-none tabular-nums text-dash-text">
              {n(r.seguimientos.activos)}
            </p>
            <p className="mt-1 font-dash-ui text-[11.5px] text-dash-text-2">activos</p>
          </div>
          <span aria-hidden className="h-[38px] w-px bg-dash-border" />
          <div>
            <p
              className={`font-dash-display text-[28px] font-bold leading-none tabular-nums ${
                r.seguimientos.vencenHoy > 0 ? "text-dash-amber" : "text-dash-text"
              }`}
            >
              {n(r.seguimientos.vencenHoy)}
            </p>
            <p className="mt-1 font-dash-ui text-[11.5px] text-dash-text-2">vencen hoy</p>
          </div>
        </div>
      </section>

      <section aria-label="Sistema" className={TARJETA}>
        <h2 className={TITULO}>Sistema</h2>
        <ul className="flex flex-col gap-2.5 font-dash-ui text-[12.5px] font-medium text-[var(--muted)]">
          <li className="flex items-center gap-2.5">
            <Punto estado={r.sistema.apiOk ? "ok" : "mal"} />
            {r.sistema.apiOk ? "API de Meta conectada" : "API de Meta sin conectar"}
          </li>
          <li className="flex items-center gap-2.5">
            <Punto estado={r.sistema.agentesIa > 0 ? "ok" : "aviso"} />
            {r.sistema.agentesIa} {r.sistema.agentesIa === 1 ? "agente IA activo" : "agentes IA activos"}
          </li>
          <li className="flex items-center gap-2.5">
            <Punto estado={r.sistema.campanasEnvio > 0 ? "aviso" : "ok"} />
            {r.sistema.campanasEnvio} {r.sistema.campanasEnvio === 1 ? "campaña en envío" : "campañas en envío"}
          </li>
        </ul>
      </section>
    </div>
  );
}
