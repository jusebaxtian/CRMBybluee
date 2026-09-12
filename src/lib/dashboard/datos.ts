import type { SupabaseClient } from "@supabase/supabase-js";
import { getPhoneNumberStatus, getWabaStatus } from "@/lib/whatsapp/graph";

/**
 * Datos del dashboard del cliente.
 *
 * Una funcion por bloque de la pantalla, para que cada tarjeta pueda cargar,
 * fallar y quedarse vacia por su cuenta. Todo sale de la base o de Meta;
 * aqui no hay ningun valor de ejemplo.
 *
 * El periodo afecta a lo que es historico (contactos nuevos, mensajes,
 * tiempo de respuesta, grafico). "Sin responder" y los pendientes son estado
 * actual y no dependen de el.
 */

// ---------------------------------------------------------------------------
// Periodo
// ---------------------------------------------------------------------------

export type Periodo =
  | { tipo: "hoy" | "7d" | "30d" }
  | { tipo: "rango"; desde: string; hasta: string };

export type RangoFechas = { desde: Date; hasta: Date; dias: number };

/** Convierte el periodo elegido en fechas concretas, en hora de Colombia. */
export function rangoDe(periodo: Periodo, ahora: Date = new Date()): RangoFechas {
  const fin = new Date(ahora);
  if (periodo.tipo === "rango") {
    const desde = new Date(`${periodo.desde}T00:00:00-05:00`);
    const hasta = new Date(`${periodo.hasta}T23:59:59.999-05:00`);
    const dias = Math.max(1, Math.round((hasta.getTime() - desde.getTime()) / 86_400_000));
    return { desde, hasta, dias };
  }
  const dias = periodo.tipo === "hoy" ? 1 : periodo.tipo === "7d" ? 7 : 30;
  const desde = new Date(fin.getTime() - dias * 86_400_000);
  return { desde, hasta: fin, dias };
}

/** El periodo inmediatamente anterior, del mismo largo, para los deltas. */
export function rangoAnterior(r: RangoFechas): RangoFechas {
  const ms = r.hasta.getTime() - r.desde.getTime();
  return { desde: new Date(r.desde.getTime() - ms), hasta: new Date(r.desde.getTime()), dias: r.dias };
}

// ---------------------------------------------------------------------------
// Cuenta
// ---------------------------------------------------------------------------

export type Cuenta = {
  estado: "activo" | "por_vencer" | "vencido";
  estadoOriginal: string;
  plan: string;
  diasRestantes: number | null;
  diasTotales: number;
  fechaRenovacion: string | null;
};

/** Dias que dura cada ciclo. `plans.billing_cycle` solo tiene estos valores. */
const DIAS_POR_CICLO: Record<string, number> = { monthly: 30, semiannual: 180 };
const DIAS_DE_PRUEBA = 7;

export async function cargarCuenta(supabase: SupabaseClient, workspaceId: string): Promise<Cuenta> {
  const [{ data: ws }, { data: sub }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("status, trial_ends_at, plans(name, billing_cycle)")
      .eq("id", workspaceId)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("current_period_end")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const plan = ws?.plans as unknown as { name: string; billing_cycle: string } | null;
  const enPrueba = ws?.status === "trialing";
  const fin = enPrueba ? ws?.trial_ends_at : sub?.current_period_end;

  const diasRestantes = fin
    ? Math.ceil((new Date(fin).getTime() - Date.now()) / 86_400_000)
    : null;
  const diasTotales = enPrueba ? DIAS_DE_PRUEBA : (DIAS_POR_CICLO[plan?.billing_cycle ?? ""] ?? 30);

  // El color lo decide el tiempo que queda, no el estado de facturacion:
  // una cuenta "active" a 3 dias de vencer tiene que verse ambar.
  const estado: Cuenta["estado"] =
    ws?.status === "canceled" || ws?.status === "past_due" || (diasRestantes !== null && diasRestantes < 0)
      ? "vencido"
      : diasRestantes !== null && diasRestantes <= 15
        ? "por_vencer"
        : "activo";

  return {
    estado,
    estadoOriginal: ws?.status ?? "unknown",
    plan: plan?.name ?? "—",
    diasRestantes,
    diasTotales,
    fechaRenovacion: fin ?? null,
  };
}

// ---------------------------------------------------------------------------
// Conexiones de WhatsApp
// ---------------------------------------------------------------------------

export type ConexionApi = {
  id: string;
  numero: string;
  etiqueta: string | null;
  estado: "conectado" | "revision" | "bloqueado";
  calidad: "alta" | "media" | "baja" | null;
  limiteDiario: number | null;
  usadoHoy: number | null;
  /** name_status de Meta: si el nombre para mostrar esta aprobado. */
  nombreVerificado: boolean | null;
  nombreParaMostrar: string | null;
  /**
   * account_review_status del WABA. Lo mas cercano a "portafolio verificado"
   * que devuelve el token: la verificacion del negocio exige un permiso que
   * el Embedded Signup no concede.
   */
  cuentaRevision: "aprobada" | "pendiente" | "rechazada" | null;
};

export type Conexiones = { conexiones: ConexionApi[]; maxPermitidoPlan: number };

/** Tramo de mensajeria de Meta -> conversaciones por 24 h. */
const LIMITE_POR_TRAMO: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
};

const CALIDAD: Record<string, ConexionApi["calidad"]> = {
  GREEN: "alta",
  YELLOW: "media",
  RED: "baja",
};

export async function cargarConexiones(supabase: SupabaseClient, workspaceId: string): Promise<Conexiones> {
  const [{ data: cuentas }, { data: ws }, { data: uso }] = await Promise.all([
    supabase
      .from("whatsapp_accounts")
      .select("id, phone_number_id, waba_id, access_token, display_phone_number, label, status")
      .eq("workspace_id", workspaceId)
      .order("connected_at", { ascending: true }),
    supabase
      .from("workspaces")
      .select("plan_id, plans(max_whatsapp_numbers)")
      .eq("id", workspaceId)
      .maybeSingle(),
    // Usuarios distintos a los que se les mando plantilla en 24 h, por
    // numero: es lo que Meta cuenta contra el limite. Antes salia de
    // conversation_opens, que esta vacia en todo el sistema.
    supabase.rpc("dashboard_uso_diario", { p_workspace_id: workspaceId }),
  ]);

  const usadoPorCuenta = new Map(
    ((uso ?? []) as { whatsapp_account_id: string | null; contactos: number }[]).map((u) => [u.whatsapp_account_id, Number(u.contactos)])
  );

  const plan = ws?.plans as unknown as { max_whatsapp_numbers: number } | null;
  const maxPermitidoPlan = plan?.max_whatsapp_numbers ?? 1;

  const conexiones = await Promise.all(
    (cuentas ?? []).map(async (c): Promise<ConexionApi> => {
      let meta: Awaited<ReturnType<typeof getPhoneNumberStatus>> | null = null;
      let waba: Awaited<ReturnType<typeof getWabaStatus>> | null = null;
      try {
        [meta, waba] = await Promise.all([
          getPhoneNumberStatus(c.phone_number_id, c.access_token),
          c.waba_id ? getWabaStatus(c.waba_id, c.access_token) : Promise.resolve(null),
        ]);
      } catch {
        // Meta caido o token vencido: la tarjeta se pinta con lo que hay en
        // la base y las metricas en blanco, no se cae el dashboard entero.
      }

      const limiteDiario = meta?.messaging_limit_tier ? (LIMITE_POR_TRAMO[meta.messaging_limit_tier] ?? null) : null;
      const revision = waba?.account_review_status;

      return {
        id: c.id,
        numero: meta?.display_phone_number ?? c.display_phone_number ?? "—",
        etiqueta: c.label,
        estado: c.status === "frozen" ? "bloqueado" : meta ? "conectado" : "revision",
        calidad: meta?.quality_rating ? (CALIDAD[meta.quality_rating] ?? null) : null,
        limiteDiario,
        usadoHoy: limiteDiario !== null ? (usadoPorCuenta.get(c.id) ?? 0) : null,
        // AVAILABLE_WITHOUT_REVIEW es un nombre aprobado que no necesito
        // revision; es el estado mas comun. Tratarlo como pendiente pintaba
        // "Nombre pendiente" en numeros perfectamente sanos.
        nombreVerificado: meta?.name_status
          ? meta.name_status === "APPROVED" || meta.name_status === "AVAILABLE_WITHOUT_REVIEW"
          : null,
        nombreParaMostrar: meta?.verified_name ?? null,
        cuentaRevision: !revision ? null : revision === "APPROVED" ? "aprobada" : revision === "REJECTED" ? "rechazada" : "pendiente",
      };
    })
  );

  return { conexiones, maxPermitidoPlan };
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export type Kpis = {
  sinResponder: number;
  /** Segundos de media entre un entrante y la siguiente respuesta. */
  tiempoRespuestaSeg: number | null;
  /** Porcentaje de cambio contra el periodo anterior; null si no hay base. */
  deltaTiempoPct: number | null;
  contactosNuevos: number;
  deltaContactosPct: number | null;
  contactosMetaAds: number;
  mensajesEnviados: number;
  deltaEnviadosPct: number | null;
};

function pct(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

export async function cargarKpis(supabase: SupabaseClient, workspaceId: string, rango: RangoFechas): Promise<Kpis> {
  const previo = rangoAnterior(rango);
  const iso = (d: Date) => d.toISOString();

  const contactosEn = (r: RangoFechas) =>
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", iso(r.desde))
      .lte("created_at", iso(r.hasta));

  const [
    { count: sinResponder },
    { count: contactosNuevos },
    { count: contactosAntes },
    { count: metaAds },
    { data: tiempos },
    { data: enviados },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("last_message_direction", "in"),
    contactosEn(rango),
    contactosEn(previo),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .not("ad_source_id", "is", null)
      .gte("last_message_at", iso(rango.desde))
      .lte("last_message_at", iso(rango.hasta)),
    supabase.rpc("dashboard_tiempo_respuesta", {
      p_workspace_id: workspaceId,
      p_desde: iso(previo.desde),
      p_corte: iso(rango.desde),
      p_hasta: iso(rango.hasta),
    }),
    supabase.rpc("dashboard_mensajes", {
      p_workspace_id: workspaceId,
      p_desde: iso(previo.desde),
      p_corte: iso(rango.desde),
      p_hasta: iso(rango.hasta),
    }),
  ]);

  const t = (tiempos ?? [])[0] as { actual_seg: number | null; anterior_seg: number | null } | undefined;
  const m = (enviados ?? [])[0] as
    | { enviados_actual: number; enviados_anterior: number; recibidos_actual: number }
    | undefined;

  return {
    sinResponder: sinResponder ?? 0,
    tiempoRespuestaSeg: t?.actual_seg ?? null,
    deltaTiempoPct: t?.actual_seg != null && t?.anterior_seg ? pct(t.actual_seg, t.anterior_seg) : null,
    contactosNuevos: contactosNuevos ?? 0,
    deltaContactosPct: pct(contactosNuevos ?? 0, contactosAntes ?? 0),
    contactosMetaAds: metaAds ?? 0,
    mensajesEnviados: m?.enviados_actual ?? 0,
    deltaEnviadosPct: pct(m?.enviados_actual ?? 0, m?.enviados_anterior ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Grafico: leads por dia
// ---------------------------------------------------------------------------

export type LeadsDia = { dia: string; etiqueta: string; nuevos: number; metaAds: number; esHoy: boolean };

export async function cargarLeadsPorDia(
  supabase: SupabaseClient,
  workspaceId: string,
  rango: RangoFechas
): Promise<LeadsDia[]> {
  const { data } = await supabase.rpc("dashboard_leads_por_dia", {
    p_workspace_id: workspaceId,
    p_desde: rango.desde.toISOString(),
    p_hasta: rango.hasta.toISOString(),
  });
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return ((data ?? []) as { dia: string; nuevos: number; meta_ads: number }[]).map((f) => ({
    dia: f.dia,
    etiqueta: new Date(`${f.dia}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short" }).replace(".", ""),
    nuevos: Number(f.nuevos),
    metaAds: Number(f.meta_ads),
    esHoy: f.dia === hoy,
  }));
}

// ---------------------------------------------------------------------------
// Pendientes de responder
// ---------------------------------------------------------------------------

export type Pendiente = {
  id: string;
  nombre: string;
  inicial: string;
  contexto: string;
  minutosEspera: number;
  urgente: boolean;
};

export async function cargarPendientes(supabase: SupabaseClient, workspaceId: string, limite = 5): Promise<Pendiente[]> {
  // Se reutiliza la funcion de la bandeja: ya devuelve el ultimo mensaje y
  // filtra por espacio. Ordena por reciente; aqui se invierte para que los
  // que llevan mas tiempo esperando vayan primero.
  const { data } = await supabase.rpc("inbox_page", {
    p_workspace_id: workspaceId,
    p_limit: 200,
    p_unread_only: false,
  });

  const filas = ((data ?? []) as {
    conversation_id: string;
    last_message_at: string;
    last_body: string | null;
    last_message_type: string | null;
    last_direction: string | null;
  }[]).filter((f) => f.last_direction === "in");

  const ids = filas.map((f) => f.conversation_id);
  if (ids.length === 0) return [];

  const { data: contactos } = await supabase
    .from("conversations")
    .select("id, contacts(name, wa_id)")
    .in("id", ids);

  const nombrePor = new Map(
    (contactos ?? []).map((c) => {
      const ct = c.contacts as unknown as { name: string | null; wa_id: string } | null;
      return [c.id as string, ct?.name?.trim() || ct?.wa_id || "—"];
    })
  );

  const ahora = Date.now();
  return filas
    .map((f) => {
      const minutos = Math.max(0, Math.floor((ahora - new Date(f.last_message_at).getTime()) / 60_000));
      const nombre = nombrePor.get(f.conversation_id) ?? "—";
      return {
        id: f.conversation_id,
        nombre,
        inicial: nombre.charAt(0).toUpperCase(),
        contexto: f.last_body ?? ETIQUETA_MEDIA[f.last_message_type ?? ""] ?? "Mensaje",
        minutosEspera: minutos,
        urgente: minutos >= 24 * 60,
      };
    })
    .sort((a, b) => b.minutosEspera - a.minutosEspera)
    .slice(0, limite);
}

const ETIQUETA_MEDIA: Record<string, string> = {
  image: "Foto",
  video: "Video",
  audio: "Nota de voz",
  document: "Documento",
  sticker: "Sticker",
};

// ---------------------------------------------------------------------------
// Mensajes, seguimientos, sistema
// ---------------------------------------------------------------------------

export type Resumen = {
  mensajes: { enviados: number; recibidos: number };
  seguimientos: { activos: number; vencenHoy: number };
  sistema: { apiOk: boolean; agentesIa: number; campanasEnvio: number };
};

export async function cargarResumen(supabase: SupabaseClient, workspaceId: string, rango: RangoFechas): Promise<Resumen> {
  const hoyInicio = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) + "T00:00:00-05:00");
  const hoyFin = new Date(hoyInicio.getTime() + 86_400_000);

  const [{ data: m }, { count: activos }, { count: vencenHoy }, { count: api }, { count: agentes }, { count: campanas }] =
    await Promise.all([
      supabase.rpc("dashboard_mensajes", {
        p_workspace_id: workspaceId,
        p_desde: rango.desde.toISOString(),
        p_corte: rango.desde.toISOString(),
        p_hasta: rango.hasta.toISOString(),
      }),
      supabase
        .from("automation_pending_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("paused", false),
      supabase
        .from("automation_pending_runs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("paused", false)
        .gte("run_at", hoyInicio.toISOString())
        .lt("run_at", hoyFin.toISOString()),
      supabase
        .from("whatsapp_accounts")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "active"),
      supabase
        .from("ai_agents")
        .select("workspace_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("is_active", true),
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "sending"),
    ]);

  const fila = (m ?? [])[0] as { enviados_actual: number; recibidos_actual: number } | undefined;

  return {
    mensajes: { enviados: fila?.enviados_actual ?? 0, recibidos: fila?.recibidos_actual ?? 0 },
    seguimientos: { activos: activos ?? 0, vencenHoy: vencenHoy ?? 0 },
    sistema: { apiOk: (api ?? 0) > 0, agentesIa: agentes ?? 0, campanasEnvio: campanas ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Aviso
// ---------------------------------------------------------------------------

export async function cargarAviso(supabase: SupabaseClient): Promise<{ imagenUrl: string } | null> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", "dashboard_banner_url").maybeSingle();
  return data?.value ? { imagenUrl: data.value } : null;
}
