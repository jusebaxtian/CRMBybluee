import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { cargarConexiones, type ConexionApi } from "@/lib/dashboard/datos";
import { ConnectWhatsAppButton } from "@/components/whatsapp/connect-whatsapp-button";

const BOTON_PRIMARIO =
  "inline-flex items-center gap-1.5 rounded-[10px] bg-dash-green px-4 py-[10px] font-dash-ui text-[12.5px] font-bold text-dash-on-green transition-colors duration-150 hover:bg-[#1fb355] disabled:opacity-50";

const ESTADO: Record<ConexionApi["estado"], { etiqueta: string; texto: string; borde: string; barra: string }> = {
  conectado: { etiqueta: "CONECTADO", texto: "text-dash-green-text", borde: "border-dash-green-28", barra: "bg-dash-green" },
  revision: { etiqueta: "EN REVISIÓN", texto: "text-dash-amber", borde: "border-dash-amber-30", barra: "bg-dash-amber" },
  bloqueado: { etiqueta: "BLOQUEADO", texto: "text-dash-red", borde: "border-dash-red-28", barra: "bg-dash-red" },
};

const CALIDAD: Record<NonNullable<ConexionApi["calidad"]>, { etiqueta: string; barras: number; color: string; texto: string }> = {
  alta: { etiqueta: "Alta", barras: 3, color: "bg-dash-green", texto: "text-dash-green" },
  media: { etiqueta: "Media", barras: 2, color: "bg-dash-amber", texto: "text-dash-amber" },
  baja: { etiqueta: "Baja", barras: 1, color: "bg-dash-red", texto: "text-dash-red" },
};

const REJILLA =
  "grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 max-[1100px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[700px]:grid-cols-[minmax(0,1fr)]";

function Tarjeta({ c }: { c: ConexionApi }) {
  const e = ESTADO[c.estado];
  const q = c.calidad ? CALIDAD[c.calidad] : null;
  const pctLimite =
    c.limiteDiario && c.usadoHoy !== null ? Math.min(100, (c.usadoHoy / c.limiteDiario) * 100) : 0;

  return (
    <article className={`rounded-[13px] border bg-dash-card-nested p-4 ${e.borde}`} aria-label={`Número ${c.numero}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`whitespace-nowrap font-dash-ui text-[10.5px] font-bold tracking-[.5px] ${e.texto}`}>● {e.etiqueta}</span>
        {c.nombreVerificado !== null && (
          <span
            className={`whitespace-nowrap rounded-[20px] px-2 py-0.5 font-dash-ui text-[10.5px] font-semibold ${
              c.nombreVerificado ? "bg-dash-green-13 text-dash-green-text" : "bg-[rgba(251,191,36,0.13)] text-dash-amber"
            }`}
          >
            {c.nombreVerificado ? "✅ Nombre verificado" : "⏳ Nombre pendiente"}
          </span>
        )}
      </div>

      <p className="mt-2 font-dash-display text-[19px] font-bold tracking-[-.3px] text-dash-text">{c.numero}</p>
      <p className="font-dash-ui text-[11.5px] text-dash-text-3">
        {[c.etiqueta, c.nombreParaMostrar].filter(Boolean).join(" · ") || "Sin etiqueta"}
      </p>

      <dl className="mt-[14px] flex flex-col gap-[9px] border-t border-dash-border-soft pt-[13px]">
        <div className="flex items-center justify-between">
          <dt className="font-dash-ui text-[11.5px] font-medium text-dash-text-2">Calidad</dt>
          <dd className="flex items-center gap-2">
            {c.estado === "revision" && !q ? (
              <span aria-label="Comprobando" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-dash-amber border-t-transparent" />
            ) : (
              <>
                <span className="flex gap-[3px]" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`h-[5px] w-[14px] rounded-[3px] ${q && i < q.barras ? q.color : "bg-[rgba(255,255,255,0.1)]"}`} />
                  ))}
                </span>
                <span className={`font-dash-ui text-[12px] font-bold ${q?.texto ?? "text-dash-text-3"}`}>{q?.etiqueta ?? "—"}</span>
              </>
            )}
          </dd>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <dt className="font-dash-ui text-[11.5px] font-medium text-dash-text-2">Límite diario</dt>
            <dd className="font-dash-ui text-[12px] font-bold tabular-nums text-dash-text">
              {c.limiteDiario !== null && c.usadoHoy !== null
                ? `${c.usadoHoy.toLocaleString("es-CO")} / ${c.limiteDiario.toLocaleString("es-CO")}`
                : "—"}
            </dd>
          </div>
          <div className="mt-1.5 h-[5px] overflow-hidden rounded-[3px] bg-dash-track" aria-hidden>
            <div className={`h-full rounded-[3px] transition-[width] duration-[400ms] ease-out ${e.barra}`} style={{ width: `${pctLimite}%` }} />
          </div>
        </div>
      </dl>
    </article>
  );
}

function SlotVacio({ n, plan }: { n: number; plan: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-[10px] rounded-[13px] border border-dashed border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.04)] p-4 text-center">
      <span aria-hidden className="text-[22px]">➕</span>
      <p className="font-dash-ui text-[13px] font-semibold text-dash-text">Espacio {n} disponible</p>
      <p className="font-dash-ui text-[11.5px] leading-[1.45] text-dash-text-3">{plan}</p>
      <ConnectWhatsAppButton label="💬 Conectar WhatsApp" askLabel className={BOTON_PRIMARIO} />
    </div>
  );
}

export async function Conexiones() {
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId(supabase);
  if (!workspaceId) return null;

  const { conexiones, maxPermitidoPlan } = await cargarConexiones(supabase, workspaceId);
  const { data: ws } = await supabase.from("workspaces").select("plans(name)").eq("id", workspaceId).maybeSingle();
  const nombrePlan = (ws?.plans as unknown as { name: string } | null)?.name ?? "tu plan";
  const textoPlan = `Tu plan ${nombrePlan} permite hasta ${maxPermitidoPlan} ${maxPermitidoPlan === 1 ? "número" : "números"}`;

  const contenedor =
    "rounded-[15px] border border-dash-green-20 bg-[linear-gradient(180deg,var(--dash-green-7),rgba(34,197,94,0.02))] p-5";

  if (conexiones.length === 0) {
    return (
      <section aria-label="Conexiones de WhatsApp API" className={`${contenedor} flex flex-wrap items-center gap-[18px]`}>
        <span aria-hidden className="text-[30px]">🔴</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-dash-display text-[17px] font-bold tracking-[-.2px] text-dash-text">Aún no tienes ninguna API conectada</h2>
          <p className="mt-1 font-dash-ui text-[12.5px] leading-[1.5] text-[rgba(232,242,236,0.55)]">
            Conecta tu número de WhatsApp Business para enviar y recibir mensajes. {textoPlan}.
          </p>
        </div>
        <ConnectWhatsAppButton
          label="💬 Conectar WhatsApp"
          className="flex-none rounded-[12px] bg-dash-green px-[22px] py-[14px] font-dash-ui text-[14px] font-bold text-dash-on-green transition-colors duration-150 hover:bg-[#1fb355] disabled:opacity-50"
        />
      </section>
    );
  }

  const libres = Math.max(0, maxPermitidoPlan - conexiones.length);

  return (
    <section aria-label="Conexiones de WhatsApp API" className={contenedor}>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span aria-hidden className="text-[20px]">💬</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-dash-display text-[17px] font-bold tracking-[-.2px] text-dash-text">Conexiones de WhatsApp API</h2>
          <p className="font-dash-ui text-[12px] text-dash-text-2">
            {conexiones.length} de {maxPermitidoPlan} {maxPermitidoPlan === 1 ? "número conectado" : "números conectados"} a la API oficial de Meta
          </p>
        </div>
        <Link
          href="/dashboard/settings"
          className="rounded-[10px] border border-[rgba(34,197,94,0.3)] px-[14px] py-2 font-dash-ui text-[12px] font-semibold text-dash-green-text transition-colors duration-150 hover:bg-dash-green-13"
        >
          Administrar
        </Link>
      </header>

      <div className={REJILLA}>
        {conexiones.map((c) => (
          <Tarjeta key={c.id} c={c} />
        ))}
        {Array.from({ length: libres }, (_, i) => (
          <SlotVacio key={`libre-${i}`} n={conexiones.length + i + 1} plan={textoPlan} />
        ))}
      </div>
    </section>
  );
}
