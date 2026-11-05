import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { listWorkspaceAgents } from "@/lib/agents";
import { isPhoneNumber } from "@/lib/whatsapp/identity";
import { esEtapa, ESTILO_ETAPA, ETAPAS, fechaDeEtapa, type Etapa } from "@/lib/leads/etapas";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

type Fila = {
  contact_id: string;
  nombre: string | null;
  wa_id: string;
  etapa: Etapa;
  frio_el: string;
  tibio_el: string | null;
  caliente_el: string | null;
  pago_el: string | null;
  asignados: string[];
  conversation_id: string | null;
  total: number;
};

type Filtros = {
  q?: string;
  etapa?: string;
  asignado?: string;
  linea?: string;
  fechaDe?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

/** Colombia no cambia de hora: el dia va de -05:00 a -05:00. */
const inicioDelDia = (dia: string) => new Date(`${dia}T00:00:00-05:00`).toISOString();
const finDelDia = (dia: string) => new Date(`${dia}T23:59:59.999-05:00`).toISOString();
const diaValido = (dia?: string) => (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : null);

const CAMPO = "rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;

  const { data: espacio } = await supabase.from("workspaces").select("id").eq("usa_etapas", true).limit(1).maybeSingle();
  if (!espacio) return <p className="p-6 text-sm text-muted">Ningún espacio tiene las etapas activadas.</p>;
  const workspaceId = espacio.id as string;

  const etapa = esEtapa(f.etapa) ? f.etapa : "";
  const fechaDe = esEtapa(f.fechaDe) ? f.fechaDe : "frio";
  const desde = diaValido(f.desde);
  const hasta = diaValido(f.hasta);
  const pagina = Math.max(1, Number(f.pagina) || 1);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [asesores, { data: lineas }] = await Promise.all([
    listWorkspaceAgents(supabase, workspaceId),
    supabase.from("whatsapp_accounts").select("id, label, display_phone_number").eq("workspace_id", workspaceId).order("connected_at"),
  ]);
  // Los asesores no incluyen al dueño, y el dueño también tiene chats asignados.
  const agentes = [
    ...(user ? [{ id: user.id, nombre: (user.user_metadata?.full_name as string | undefined) || user.email || "Yo" }] : []),
    ...asesores.filter((a) => a.id !== user?.id).map((a) => ({ id: a.id, nombre: a.name || a.email })),
  ];
  const asignado = f.asignado === "sin" || agentes.some((a) => a.id === f.asignado) ? (f.asignado as string) : "";
  const linea = (lineas ?? []).some((l) => l.id === f.linea) ? (f.linea as string) : "";

  const comunes = {
    p_workspace: workspaceId,
    p_q: f.q?.trim() || null,
    p_asignado: asignado || null,
    p_linea: linea || null,
    p_fecha_de: fechaDe,
    p_desde: desde ? inicioDelDia(desde) : null,
    p_hasta: hasta ? finDelDia(hasta) : null,
  };
  const [{ data: filas, error }, { data: totales }] = await Promise.all([
    supabase.rpc("leads_pagina", { ...comunes, p_etapa: etapa || null, p_limit: POR_PAGINA, p_offset: (pagina - 1) * POR_PAGINA }),
    supabase.rpc("leads_totales", comunes),
  ]);
  if (error) console.error("leads_pagina:", error.message);

  const lista = (filas ?? []) as Fila[];
  const total = Number(lista[0]?.total ?? 0);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const porEtapa = new Map(((totales ?? []) as { etapa: string; total: number }[]).map((t) => [t.etapa, Number(t.total)]));
  const nombreDe = new Map(agentes.map((a) => [a.id, a.nombre]));

  const enlace = (cambios: Partial<Filtros>) => {
    const p = new URLSearchParams();
    const todo: Filtros = { q: f.q, etapa, asignado, linea, fechaDe, desde: desde ?? "", hasta: hasta ?? "", ...cambios };
    for (const [clave, valor] of Object.entries(todo)) {
      if (!valor || (clave === "fechaDe" && valor === "frio")) continue;
      p.set(clave, valor);
    }
    const texto = p.toString();
    return texto ? `/admin/leads?${texto}` : "/admin/leads";
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-dash-display text-[22px] font-bold tracking-[-.4px] text-foreground">Leads</h1>
        <Link
          href={etapa ? `/dashboard/campaigns/new?etapa=${etapa}` : "/dashboard/campaigns/new"}
          className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-hover"
        >
          {etapa ? `Crear campaña para ${ESTILO_ETAPA[etapa].texto}` : "Crear campaña"}
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {ETAPAS.map((e) => (
          <Link
            key={e}
            href={enlace({ etapa: etapa === e ? "" : e })}
            aria-current={etapa === e ? "true" : undefined}
            className={`rounded-[13px] border bg-surface p-3 hover:bg-surface-hover ${etapa === e ? "border-primary" : "border-border"}`}
          >
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${ESTILO_ETAPA[e].clase}`}>{ESTILO_ETAPA[e].texto}</span>
            <p className="mt-1 text-xl font-semibold text-foreground">{(porEtapa.get(e) ?? 0).toLocaleString("es-CO")}</p>
          </Link>
        ))}
      </div>

      <form method="get" action="/admin/leads" className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-muted">
          Buscar
          <input name="q" defaultValue={f.q ?? ""} placeholder="Nombre o número" className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Etapa
          <select name="etapa" defaultValue={etapa} className={CAMPO}>
            <option value="">Todas</option>
            {ETAPAS.map((e) => (
              <option key={e} value={e}>{ESTILO_ETAPA[e].texto}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Asignado
          <select name="asignado" defaultValue={asignado} className={CAMPO}>
            <option value="">Todos</option>
            <option value="sin">Sin asignar</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </label>
        {(lineas ?? []).length > 1 && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Línea
            <select name="linea" defaultValue={linea} className={CAMPO}>
              <option value="">Todas</option>
              {(lineas ?? []).map((l) => (
                <option key={l.id} value={l.id}>{l.label || l.display_phone_number}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          Fecha en que llegó a
          <select name="fechaDe" defaultValue={fechaDe} className={CAMPO}>
            {ETAPAS.map((e) => (
              <option key={e} value={e}>{ESTILO_ETAPA[e].texto}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Desde
          <input type="date" name="desde" defaultValue={desde ?? ""} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta ?? ""} className={CAMPO} />
        </label>
        <button type="submit" className="rounded-[9px] bg-primary px-4 py-2 text-[13px] font-medium text-white">Filtrar</button>
        <Link href="/admin/leads" className="px-2 py-2 text-[13px] text-muted hover:text-foreground">Limpiar</Link>
      </form>

      <div className="mt-4 overflow-x-auto rounded-[13px] border border-border bg-surface">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="p-3 font-medium">Contacto</th>
              {ETAPAS.map((e) => (
                <th key={e} className="p-3 font-medium">{ESTILO_ETAPA[e].texto}</th>
              ))}
              <th className="p-3" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => {
              const nombres = l.asignados.map((id) => nombreDe.get(id) ?? "Otro usuario");
              const fechas: Record<Etapa, string | null> = { frio: l.frio_el, tibio: l.tibio_el, caliente: l.caliente_el, pago: l.pago_el };
              return (
                <tr key={l.contact_id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <p className="font-semibold text-foreground">{l.nombre?.trim() || "Sin nombre"}</p>
                    <p className="text-xs text-muted">{isPhoneNumber(l.wa_id) ? `+${l.wa_id.replace(/^\+/, "")}` : "Usuario sin número"}</p>
                    <p className="text-xs text-muted">{nombres.length > 0 ? `Asignado: ${nombres.join(", ")}` : "Sin asignar"}</p>
                  </td>
                  {ETAPAS.map((e) => {
                    const r = fechaDeEtapa(e, l.etapa, fechas[e]);
                    return (
                      <td key={e} className="p-3 align-middle">
                        {r.tipo === "sin-llegar" ? (
                          <span className="text-xs text-muted">Sin llegar</span>
                        ) : (
                          <>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${ESTILO_ETAPA[e].clase}`}>{ESTILO_ETAPA[e].texto}</span>
                            <p className="mt-1 whitespace-nowrap text-xs text-muted">{r.tipo === "fecha" ? fecha(r.fecha) : "Sin fecha"}</p>
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-3 text-right">
                    {l.conversation_id && (
                      <Link
                        href={`/dashboard/inbox/${l.conversation_id}`}
                        className="inline-block whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover"
                      >
                        Ir al chat
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted">
                  {error ? "No se pudieron cargar los leads." : "Ningún contacto coincide con estos filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>{total.toLocaleString("es-CO")} contactos</span>
        <div className="flex items-center gap-3">
          {pagina > 1 && <Link href={enlace({ pagina: String(pagina - 1) })} className="hover:text-foreground">Anterior</Link>}
          <span>Página {pagina} de {totalPaginas}</span>
          {pagina < totalPaginas && <Link href={enlace({ pagina: String(pagina + 1) })} className="hover:text-foreground">Siguiente</Link>}
        </div>
      </div>
    </div>
  );
}
