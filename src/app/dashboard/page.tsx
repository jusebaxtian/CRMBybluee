import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Space_Grotesk, Manrope } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceId } from "@/lib/workspace";
import { rangoDe, cargarAviso, type Periodo } from "@/lib/dashboard/datos";
import { TagStatsTable } from "@/components/tags/tag-stats-table";
import { PeriodoSelector } from "@/components/dashboard/periodo-selector";
import { Bloque } from "@/components/dashboard/bloque";
import { Aviso } from "@/components/dashboard/aviso";
import { EstadoCuenta } from "@/components/dashboard/estado-cuenta";
import { Conexiones } from "@/components/dashboard/conexiones";
import { Kpis } from "@/components/dashboard/kpis";
import { LeadsPorDia } from "@/components/dashboard/leads-por-dia";
import { Pendientes } from "@/components/dashboard/pendientes";
import { Resumen } from "@/components/dashboard/resumen";
import {
  EsqueletoTarjeta,
  EsqueletoKpis,
  EsqueletoConexiones,
  EsqueletoFila,
} from "@/components/dashboard/esqueletos";

// Las dos fuentes del diseño se cargan solo en esta pantalla: el resto del
// panel sigue con Geist. next/font expone cada una como variable CSS, que
// globals.css mapea a font-dash-display y font-dash-ui.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-space-grotesk" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope" });

function leerPeriodo(params: Record<string, string | string[] | undefined>): Periodo {
  const desde = typeof params.desde === "string" ? params.desde : null;
  const hasta = typeof params.hasta === "string" ? params.hasta : null;
  if (desde && hasta && /^\d{4}-\d{2}-\d{2}$/.test(desde) && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return { tipo: "rango", desde, hasta };
  }
  const p = typeof params.periodo === "string" ? params.periodo : "7d";
  return { tipo: p === "hoy" || p === "30d" ? p : "7d" };
}

function saludo(): string {
  const hora = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Bogota" }));
  return hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const locked = typeof params.locked === "string" ? params.locked : null;
  const tagsFrom = typeof params.tagsFrom === "string" ? params.tagsFrom : null;
  const tagsTo = typeof params.tagsTo === "string" ? params.tagsTo : null;
  const tagsFromIso = tagsFrom ? new Date(`${tagsFrom}T00:00:00`).toISOString() : null;
  const tagsToIso = tagsTo ? new Date(`${tagsTo}T23:59:59.999`).toISOString() : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getWorkspaceId(supabase);

  const periodo = leerPeriodo(params);
  const rango = rangoDe(periodo);
  const etiquetaPeriodo =
    periodo.tipo === "hoy" ? "ayer" : periodo.tipo === "7d" ? "la semana anterior" : periodo.tipo === "30d" ? "el mes anterior" : "el periodo anterior";

  // Decide la primera fila: sin aviso, Estado de cuenta ocupa todo el ancho.
  const hayAviso = (await cargarAviso(supabase)) !== null;

  const nombre =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? user.email?.split("@")[0] ?? "";
  const fecha = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });

  // --- Tabla de etiquetas: ya existia y se conserva bajo el diseño nuevo. ---
  let contactsCountQuery = workspaceId
    ? supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId)
    : null;
  if (contactsCountQuery && tagsFromIso) contactsCountQuery = contactsCountQuery.gte("created_at", tagsFromIso);
  if (contactsCountQuery && tagsToIso) contactsCountQuery = contactsCountQuery.lte("created_at", tagsToIso);

  const [{ data: tagsRaw }, { data: tagCounts }, { count: totalContacts }] = await Promise.all([
    workspaceId
      ? supabase.from("tags").select("id, name, color").eq("workspace_id", workspaceId).order("position")
      : Promise.resolve({ data: [] as { id: string; name: string; color: string }[] }),
    workspaceId
      ? supabase.rpc("tag_contact_counts", { p_workspace_id: workspaceId, p_created_from: tagsFromIso, p_created_to: tagsToIso })
      : Promise.resolve({ data: [] as { tag_id: string; contact_count: number }[] }),
    contactsCountQuery ?? Promise.resolve({ count: 0 }),
  ]);
  const countByTagId = new Map(
    ((tagCounts ?? []) as { tag_id: string; contact_count: number }[]).map((r) => [r.tag_id, Number(r.contact_count)])
  );
  const tagStats = (tagsRaw ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color, count: countByTagId.get(t.id) ?? 0 }));

  return (
    <div className={`${spaceGrotesk.variable} ${manrope.variable} -m-4 flex flex-col gap-5 bg-dash-bg p-6 font-dash-ui text-dash-text sm:-m-5 sm:px-7`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-dash-text">
            {saludo()}{nombre ? `, ${nombre}` : ""}
          </h1>
          <p className="mt-0.5 text-[13px] capitalize text-dash-text-2">{fecha}</p>
        </div>
        <PeriodoSelector
          activo={periodo.tipo}
          desde={periodo.tipo === "rango" ? periodo.desde : null}
          hasta={periodo.tipo === "rango" ? periodo.hasta : null}
        />
      </header>

      {locked && (
        <div className="rounded-[13px] border border-dash-amber-30 bg-[rgba(234,179,8,0.08)] p-4 text-[13px] text-dash-amber">
          El módulo &quot;{locked}&quot; no está incluido en tu plan actual. Contacta a soporte para activarlo.
        </div>
      )}

      {/* Fila 1: aviso + estado de cuenta (o solo estado, a ancho completo) */}
      <div className={hayAviso ? "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 max-[900px]:grid-cols-[minmax(0,1fr)]" : "grid"}>
        {hayAviso && (
          <Bloque nombre="los avisos">
            <Suspense fallback={<EsqueletoTarjeta />}>
              <Aviso />
            </Suspense>
          </Bloque>
        )}
        <Bloque nombre="el estado de cuenta">
          <Suspense fallback={<EsqueletoTarjeta />}>
            <EstadoCuenta />
          </Suspense>
        </Bloque>
      </div>

      {/* Fila 2: conexiones */}
      <Bloque nombre="las conexiones de WhatsApp">
        <Suspense fallback={<EsqueletoConexiones />}>
          <Conexiones />
        </Suspense>
      </Bloque>

      {/* Fila 3: KPIs */}
      <Bloque nombre="los indicadores">
        <Suspense fallback={<EsqueletoKpis />}>
          <Kpis rango={rango} etiquetaPeriodo={etiquetaPeriodo} />
        </Suspense>
      </Bloque>

      {/* Fila 4: grafico + pendientes */}
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-4 max-[900px]:grid-cols-[minmax(0,1fr)]">
        <Bloque nombre="el gráfico de leads">
          <Suspense fallback={<EsqueletoFila alto="h-[262px]" />}>
            <LeadsPorDia rango={rango} />
          </Suspense>
        </Bloque>
        <Bloque nombre="los pendientes">
          <Suspense fallback={<EsqueletoFila alto="h-[262px]" />}>
            <Pendientes />
          </Suspense>
        </Bloque>
      </div>

      {/* Fila 5: mensajes / seguimientos / sistema */}
      <Bloque nombre="el resumen">
        <Suspense fallback={<EsqueletoFila alto="h-[132px]" />}>
          <Resumen rango={rango} />
        </Suspense>
      </Bloque>

      <TagStatsTable tags={tagStats} totalContacts={totalContacts ?? 0} dateFrom={tagsFrom} dateTo={tagsTo} />
    </div>
  );
}
