import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { getWorkspaceId } from "@/lib/workspace";
import { FidelidadConfigPanel } from "@/components/admin/fidelidad-config";
import { ReferidosRevision } from "@/components/admin/referidos-revision";
import { aplicarFrenos, calidadDeLaLinea, leerConfigFidelidad, planificar } from "@/lib/fidelidad/envio";
import {
  DIAS_PARA_LA_BAJA,
  ETAPAS,
  RESPUESTA_BAJA,
  RESPUESTA_VOLVER,
  diasDespuesDe,
  etapaPorClave,
  fechaBogota,
} from "@/lib/fidelidad/etapas";

export const dynamic = "force-dynamic";

const hora = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" });

const ESTILO_ESTADO: Record<string, string> = {
  enviado: "bg-success/15 text-success",
  enviando: "bg-warning/15 text-warning",
  fallido: "bg-error/15 text-error",
};

export default async function FidelidadPage() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;

  const admin = createAdminClient();
  const config = await leerConfigFidelidad(admin);
  const ahora = new Date();
  const hoy = fechaBogota(ahora);

  // Las lineas son las del espacio del propio administrador.
  const espacioPropio = await getWorkspaceId(supabase);
  const { data: lineas } = espacioPropio
    ? await admin
        .from("whatsapp_accounts")
        .select("id, label, display_phone_number")
        .eq("workspace_id", espacioPropio)
        .neq("status", "frozen")
        .order("connected_at")
    : { data: null };

  const plan = await planificar(admin, ahora, config);
  const espacioDelAdmin = plan.espacioDelAdmin;
  // Misma regla que el envio real: calidad de la linea y tope del dia.
  const calidad = config.whatsappAccountId ? await calidadDeLaLinea(admin, config.whatsappAccountId) : null;
  const decisiones = aplicarFrenos(plan.decisiones, { calidad, enviadosHoy: plan.enviadosHoy, tope: config.topeDiario });
  const textoCalidad = calidad === "GREEN" ? "Alta (verde)" : calidad === "YELLOW" ? "Media (amarilla)" : calidad === "RED" ? "Baja (roja)" : "No se pudo consultar";

  const { data: registro } = await admin
    .from("fidelidad_envios")
    .select("id, workspace_nombre, etapa, periodo, modo, estado, error, creado_el")
    .order("creado_el", { ascending: false })
    .limit(60);

  // Respuestas a los botones del ultimo aviso, con el cliente al que corresponden.
  const { data: taps } = espacioDelAdmin
    ? await admin
        .from("messages")
        .select("body, created_at, conversations!inner(workspace_id, contacts(wa_id, name))")
        .eq("conversations.workspace_id", espacioDelAdmin)
        .eq("direction", "in")
        .eq("message_type", "button")
        .in("body", [RESPUESTA_BAJA, RESPUESTA_VOLVER])
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: null };

  // Candidatos a baja: sin plan desde hace mas de 30 + 7 dias y que YA recibieron
  // el ultimo aviso real. Sin ese aviso nadie aparece, por mucho que haya vencido.
  const { data: avisados } = await admin
    .from("fidelidad_envios")
    .select("workspace_id")
    .eq("etapa", "ultimo_aviso_30_dias")
    .eq("modo", "real")
    .eq("estado", "enviado");
  const idsAvisados = [...new Set((avisados ?? []).map((a) => a.workspace_id as string))];

  type Candidato = { id: string; nombre: string; dias: number; pagos: number };
  const candidatos: Candidato[] = [];
  if (idsAvisados.length > 0) {
    const [{ data: espacios }, { data: subs }, { data: pagos }] = await Promise.all([
      admin.from("workspaces").select("id, name, status").in("id", idsAvisados).eq("status", "past_due"),
      admin.from("subscriptions").select("workspace_id, current_period_end").in("workspace_id", idsAvisados),
      admin.from("payments").select("workspace_id").in("workspace_id", idsAvisados).eq("status", "approved"),
    ]);
    for (const e of espacios ?? []) {
      const fin = (subs ?? [])
        .filter((s) => s.workspace_id === e.id && s.current_period_end)
        .map((s) => fechaBogota(new Date(s.current_period_end)))
        .sort()
        .pop();
      if (!fin) continue;
      const dias = diasDespuesDe(fin, hoy);
      if (dias >= 30 + DIAS_PARA_LA_BAJA) {
        candidatos.push({ id: e.id, nombre: e.name, dias, pagos: (pagos ?? []).filter((p) => p.workspace_id === e.id).length });
      }
    }
  }

  // Referidos: quien refirio a quien, y los que esperan decision del administrador.
  const { data: referidos } = await admin
    .from("referral_rewards")
    .select("id, status, motivo_revision, created_at, referrer:workspaces!referral_rewards_referrer_id_fkey(name), referred:workspaces!referral_rewards_referred_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(60);
  const nombreDe = (v: unknown) => (v as { name?: string } | null)?.name ?? "—";
  const ESTADO_REFERIDO: Record<string, string> = {
    en_revision: "En revisión",
    disponible: "Mes disponible",
    usado: "Mes usado",
    rechazado: "Rechazado",
  };

  const aEnviar = decisiones.filter((d) => d.accion === "enviar");
  const omitidas = decisiones.filter((d) => d.accion !== "enviar");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Plan de fidelidad</h1>
        <p className="mt-1 text-sm text-muted">
          Los mensajes que Bybluee les manda a sus clientes según el ciclo de su plan: bienvenida, avisos de vencimiento
          y recuperación. Salen entre las 9:00 y las 18:00 de Bogotá, una vez por cliente y periodo, y como máximo uno al
          día. Las etiquetas de «no seguimiento» no los frenan.
        </p>
        <p className="mt-2 text-sm">
          Estado:{" "}
          <strong className={config.activo ? "text-success" : "text-muted"}>{config.activo ? "encendido" : "apagado"}</strong>
          {" · "}
          modo <strong>{config.modo === "real" ? "real" : "prueba"}</strong>
          {" · "}
          calidad de la línea:{" "}
          <strong className={calidad === "GREEN" ? "text-success" : calidad === "RED" ? "text-error" : "text-warning"}>{textoCalidad}</strong>
          {" · "}
          hoy {plan.enviadosHoy} de {config.topeDiario} mensajes
        </p>
        {calidad !== "GREEN" && (
          <p className="mt-1 text-xs text-muted">
            {calidad === "RED"
              ? "Con calidad baja no sale ningún mensaje del plan."
              : "Con la línea fuera de verde solo salen los mensajes Utility; las etapas de Marketing se frenan solas."}
          </p>
        )}
      </div>

      <FidelidadConfigPanel
        inicial={config}
        lineas={(lineas ?? []).map((l) => ({
          id: l.id,
          etiqueta: l.label ? `${l.display_phone_number} · ${l.label}` : l.display_phone_number,
        }))}
        etapas={ETAPAS.map((e) => ({ clave: e.clave, titulo: e.titulo, categoria: e.categoria, plantilla: e.plantilla }))}
      />

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-1 text-sm font-medium text-foreground">Qué saldría hoy ({hoy})</p>
        <p className="mb-3 text-xs text-muted">
          Es una vista previa: no envía nada. Muestra a quién le toca hoy según su fecha de vencimiento y por qué se omite
          a quien no.
        </p>
        {decisiones.length === 0 ? (
          <p className="text-sm text-muted">A ningún cliente le toca una etapa hoy.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {[...aEnviar, ...omitidas].map((d) => (
              <li key={`${d.workspaceId}-${d.etapa.clave}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <Link href={`/admin/workspaces/${d.workspaceId}`} className="font-medium text-foreground hover:underline">
                  {d.negocio}
                </Link>
                <span className="text-muted">{d.etapa.titulo}</span>
                <span className={`ml-auto text-xs ${d.accion === "enviar" ? "font-semibold text-success" : "text-muted"}`}>
                  {d.accion === "enviar" ? "Saldría" : d.accion}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-1 text-sm font-medium text-foreground">Candidatos a baja</p>
        <p className="mb-3 text-xs text-muted">
          Clientes sin plan hace más de {30 + DIAS_PARA_LA_BAJA} días que ya recibieron el último aviso (la fecha que
          prometimos ya pasó). Nada se borra solo: abre el cliente y usa «Eliminar workspace» si decides darlo de baja.
        </p>
        {candidatos.length === 0 ? (
          <p className="text-sm text-muted">Ninguno por ahora.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {candidatos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <Link href={`/admin/workspaces/${c.id}`} className="font-medium text-foreground hover:underline">
                  {c.nombre}
                </Link>
                <span className="text-muted">{c.dias} días sin plan</span>
                <span className={`ml-auto text-xs ${c.pagos > 0 ? "font-semibold text-error" : "text-muted"}`}>
                  {c.pagos > 0 ? `Ha pagado ${c.pagos} ${c.pagos === 1 ? "vez" : "veces"}: revisar con cuidado` : "Nunca ha pagado"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">Respuestas al último aviso</p>
        {(taps ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nadie ha respondido todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {(taps ?? []).map((t, i) => {
              const conv = t.conversations as unknown as { contacts: { wa_id: string; name: string | null } | null } | null;
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 py-2">
                  <span className="font-medium text-foreground">{conv?.contacts?.name ?? conv?.contacts?.wa_id ?? "—"}</span>
                  <span className={t.body === RESPUESTA_BAJA ? "text-error" : "text-success"}>{t.body}</span>
                  <span className="ml-auto text-xs text-muted">{hora.format(new Date(t.created_at))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-1 text-sm font-medium text-foreground">Referidos</p>
        <p className="mb-3 text-xs text-muted">
          Cada cliente con licencia de pago tiene un enlace; cuando su referido hace su primer pago gana un mes (máximo 3). Si
          comparten IP, teléfono o documento queda en revisión para que lo decidas.
        </p>
        {(referidos ?? []).length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay referidos con pago.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {(referidos ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium text-foreground">{nombreDe(r.referrer)}</span>
                <span className="text-muted">refirió a</span>
                <span className="font-medium text-foreground">{nombreDe(r.referred)}</span>
                <span className="rounded-full bg-border px-2 py-0.5 text-[11px] text-muted">{ESTADO_REFERIDO[r.status] ?? r.status}</span>
                {r.status === "en_revision" && (
                  <>
                    <span className="text-xs text-warning">{r.motivo_revision}</span>
                    <ReferidosRevision id={r.id} />
                  </>
                )}
                <span className="ml-auto text-xs text-muted">{hora.format(new Date(r.created_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">Últimos envíos</p>
        {(registro ?? []).length === 0 ? (
          <p className="text-sm text-muted">Todavía no se ha enviado nada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {(registro ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium text-foreground">{r.workspace_nombre ?? "—"}</span>
                <span className="text-muted">{etapaPorClave(r.etapa)?.titulo ?? r.etapa}</span>
                {r.modo === "prueba" && <span className="rounded-full bg-border px-2 py-0.5 text-[11px] text-muted">prueba</span>}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_ESTADO[r.estado] ?? ""}`}>{r.estado}</span>
                {r.error && <span className="text-xs text-error">{r.error}</span>}
                <span className="ml-auto text-xs text-muted">{hora.format(new Date(r.creado_el))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
