import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhoneNumberStatus, sendTemplateMessage } from "@/lib/whatsapp/graph";
import { abrirConversacion } from "@/lib/whatsapp/conversacion";
import { recordOutboundMessage } from "@/lib/messaging/record";
import {
  ETAPAS,
  ETAPAS_APAGADAS_POR_DEFECTO,
  HORAS_DE_BIENVENIDA,
  RESPUESTA_BAJA,
  RESPUESTA_VOLVER,
  cuerpoRenderizado,
  HORAS_PARA_AVISAR_REGISTRO,
  dentroDeLaVentana,
  puedeSalirAhora,
  diasDespuesDe,
  etapasDeHoy,
  fechaBogota,
  frenoDeCalidad,
  parametrosDe,
  saludoDe,
  type Etapa,
} from "@/lib/fidelidad/etapas";

/**
 * Plan de fidelidad: lo que la plataforma le escribe a sus clientes segun el
 * ciclo de su cuenta (demo, compra, conexion, vencimiento, recuperacion).
 *
 * Reglas, para que no haya que adivinarlas leyendo el codigo:
 * - Sale por UNA linea de WhatsApp elegida en el Admin, con plantillas aprobadas.
 * - Una vez por cliente, etapa y periodo (restriccion unica en la base), y como
 *   maximo un mensaje por cliente al dia: si coinciden dos, sale el de menor
 *   `prio` (vencimiento, luego bienvenida, luego conexion) y el otro se omite.
 * - Solo entre las 9:00 y las 18:00 de Bogota (salvo las etapas `sinHorario`,
 *   como el aviso de registro sin plan, que sale al crearse la cuenta), espaciados entre si, con un tope
 *   diario. Es para no parecer una rafaga: la calidad de la linea es lo que
 *   protege todo lo demas.
 * - Freno de calidad: con la linea en media solo salen los Utility; en baja,
 *   nada. Ver `frenoDeCalidad`.
 * - NO mira etiquetas de "no seguimiento" ni `conversations.followups_enabled`:
 *   esas reglas existen para no molestar con seguimientos de venta, y estos
 *   mensajes son avisos de la cuenta que el cliente necesita recibir. Lo que si
 *   respeta es lo que Meta ya decidio: un contacto marcado como no apto para
 *   Marketing no recibe las etapas de Marketing.
 * - Cada mensaje queda guardado en el chat de la linea, marcado para que no
 *   dispare seguimientos, asi se ve su estado (entregado, leido) y las
 *   respuestas del cliente.
 */

const CLAVE_AJUSTE = "fidelidad";

/** Pausa entre un envio y el siguiente. */
const PAUSA_ENTRE_ENVIOS_MS = 20_000;

export type ConfigFidelidad = {
  activo: boolean;
  /** "prueba": todo llega al telefono de prueba. "real": llega al cliente. */
  modo: "prueba" | "real";
  telefonoPrueba: string;
  whatsappAccountId: string;
  /** Etapas apagadas individualmente; las que no aparecen estan encendidas. */
  etapasApagadas: string[];
  /** Maximo de mensajes del plan por dia. */
  topeDiario: number;
};

export const CONFIG_POR_DEFECTO: ConfigFidelidad = {
  activo: false,
  modo: "prueba",
  telefonoPrueba: "",
  whatsappAccountId: "",
  etapasApagadas: ETAPAS_APAGADAS_POR_DEFECTO,
  topeDiario: 15,
};

export async function leerConfigFidelidad(admin: SupabaseClient = createAdminClient()): Promise<ConfigFidelidad> {
  const { data } = await admin.from("platform_settings").select("value").eq("key", CLAVE_AJUSTE).maybeSingle();
  if (!data?.value) return CONFIG_POR_DEFECTO;
  try {
    return { ...CONFIG_POR_DEFECTO, ...(JSON.parse(data.value) as Partial<ConfigFidelidad>) };
  } catch {
    return CONFIG_POR_DEFECTO;
  }
}

export type Decision = {
  workspaceId: string;
  negocio: string;
  telefono: string;
  etapa: Etapa;
  /** Fecha de vencimiento (o de inicio, en las etapas que se cuentan desde ahi) a la que pertenece el aviso. */
  periodo: string;
  parametros: string[];
  /** "enviar", o el motivo por el que se omite. */
  accion: "enviar" | string;
};

const digitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");

type FilaPrevia = { workspace_id: string; etapa: string; periodo: string; estado: string; creado_el: string; actualizado_el: string };

/**
 * Quien recibiria que HOY, y quien se omite y por que.
 *
 * Es de solo lectura: lo usa tanto el trabajo (que envia las decisiones
 * "enviar") como la pantalla del Admin (que las muestra sin enviar nada).
 * Los frenos que dependen de la calidad de la linea y del tope diario se
 * aplican aparte, con `aplicarFrenos`.
 */
export async function planificar(
  admin: SupabaseClient,
  ahora: Date,
  config: ConfigFidelidad
): Promise<{ decisiones: Decision[]; espacioDelAdmin: string | null; enviadosHoy: number }> {
  const hoy = fechaBogota(ahora);

  const { data: linea } = config.whatsappAccountId
    ? await admin.from("whatsapp_accounts").select("workspace_id").eq("id", config.whatsappAccountId).maybeSingle()
    : { data: null };
  const espacioDelAdmin = (linea?.workspace_id as string | undefined) ?? null;

  const [{ data: espacios }, { data: suscripciones }, { data: duenos }, { data: lineas }, { data: demos }, { data: planesDemo }] = await Promise.all([
    // Son ~100 espacios; PostgREST corta en 1000 sin avisar, asi que si esto
    // creciera hay que paginar.
    admin.from("workspaces").select("id, name, status, access_disabled, phone, phone_e164, plan_id, created_at"),
    admin.from("subscriptions").select("workspace_id, current_period_end, created_at"),
    admin.from("workspace_members").select("workspace_id, user_id").eq("role", "owner"),
    admin.from("whatsapp_accounts").select("workspace_id"),
    admin
      .from("invitaciones_registro")
      .select("workspace_id, dias_demo")
      .eq("tipo", "demo")
      .eq("status", "used")
      .not("workspace_id", "is", null),
    admin.from("plans").select("id").eq("is_demo", true),
  ]);

  const diasDemoDe = new Map((demos ?? []).map((d) => [d.workspace_id as string, d.dias_demo as number | null]));
  const planDemo = new Set((planesDemo ?? []).map((p) => p.id as string));
  // Es demo quien tiene el plan DEMO o nacio de un enlace demo...
  const posiblesDemo = new Set<string>([
    ...diasDemoDe.keys(),
    ...(espacios ?? []).filter((e) => e.plan_id && planDemo.has(e.plan_id)).map((e) => e.id as string),
  ]);
  // ...y deja de serlo cuando paga: desde ahi es un cliente normal.
  const { data: pagos } =
    posiblesDemo.size > 0
      ? await admin.from("payments").select("workspace_id").eq("status", "approved").in("workspace_id", [...posiblesDemo])
      : { data: [] as { workspace_id: string }[] };
  const pagaron = new Set((pagos ?? []).map((p) => p.workspace_id as string));
  const conLinea = new Set((lineas ?? []).map((l) => l.workspace_id as string));

  const fin = new Map<string, string>();
  const primera = new Map<string, string>();
  for (const s of suscripciones ?? []) {
    if (s.current_period_end) {
      const f = fechaBogota(new Date(s.current_period_end));
      if (!fin.has(s.workspace_id) || f > fin.get(s.workspace_id)!) fin.set(s.workspace_id, f);
    }
    if (s.created_at && (!primera.has(s.workspace_id) || s.created_at < primera.get(s.workspace_id)!)) {
      primera.set(s.workspace_id, s.created_at);
    }
  }

  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const usuarios = new Map((lista?.users ?? []).map((u) => [u.id, u]));
  const duenoDe = new Map((duenos ?? []).map((d) => [d.workspace_id as string, d.user_id as string]));

  // Que le toca a cada espacio hoy. Si coinciden varias etapas, gana la de menor prio.
  const candidatos: Decision[] = [];
  for (const e of espacios ?? []) {
    if (e.id === espacioDelAdmin) continue;
    const telefono = digitos(e.phone_e164 || e.phone);
    const usuario = usuarios.get(duenoDe.get(e.id) ?? "");
    const persona = (usuario?.user_metadata?.full_name as string | undefined) ?? null;
    const correo = usuario?.email ?? "";
    const saludo = saludoDe(persona, e.name);
    const vencimiento = fin.get(e.id) ?? null;
    const activada = primera.get(e.id);
    const inicio = activada ? fechaBogota(new Date(activada)) : null;
    const esDemo = posiblesDemo.has(e.id) && !pagaron.has(e.id);
    // La duracion sale del enlace, o de la distancia entre el inicio y el fin de la prueba.
    const diasDemo = diasDemoDe.get(e.id) ?? (inicio && vencimiento ? diasDespuesDe(inicio, vencimiento) : null);

    const delDia: { etapa: Etapa; periodo: string | null }[] = [];

    // La bienvenida no depende de la fecha de fin: sale si la cuenta es reciente.
    if (activada && e.status === "active" && !e.access_disabled && ahora.getTime() - new Date(activada).getTime() < HORAS_DE_BIENVENIDA * 3600_000) {
      const clave = esDemo ? "demo_bienvenida" : "bienvenida";
      const etapa = ETAPAS.find((x) => x.clave === clave);
      if (etapa) delDia.push({ etapa, periodo: inicio });
    }
    // Se registro por su cuenta y no ha pagado nunca: el aviso sale en cuanto se crea la cuenta.
    if (!activada && !esDemo && e.status === "past_due" && !e.access_disabled && e.created_at) {
      const registro = ETAPAS.find((x) => x.clave === "registro_sin_plan");
      if (registro && ahora.getTime() - new Date(e.created_at).getTime() < HORAS_PARA_AVISAR_REGISTRO * 3600_000) {
        delDia.push({ etapa: registro, periodo: fechaBogota(new Date(e.created_at)) });
      }
    }
    for (const etapa of etapasDeHoy(
      { estado: e.status, accesoDesactivado: !!e.access_disabled, vencimiento, esDemo, diasDemo, inicio, tieneLinea: conLinea.has(e.id) },
      hoy
    )) {
      delDia.push({ etapa, periodo: etapa.ancla === "inicio" ? inicio : vencimiento });
    }
    if (delDia.length === 0) continue;

    delDia.sort((a, b) => a.etapa.prio - b.etapa.prio || ETAPAS.indexOf(a.etapa) - ETAPAS.indexOf(b.etapa));
    delDia.forEach(({ etapa, periodo }) => {
      if (!periodo) return;
      candidatos.push({
        workspaceId: e.id,
        negocio: e.name,
        telefono,
        etapa,
        periodo,
        parametros: parametrosDe(etapa, { saludo, negocio: e.name, correo, vencimiento, hoy, diasDemo }),
        accion: "enviar",
      });
    });
  }
  if (candidatos.length === 0) return { decisiones: [], espacioDelAdmin, enviadosHoy: 0 };

  // Lo ya enviado o intentado, para no repetir.
  const desde = new Date(ahora.getTime() - 3 * 86_400_000).toISOString();
  const { data: previos } = await admin
    .from("fidelidad_envios")
    .select("workspace_id, etapa, periodo, estado, creado_el, actualizado_el")
    .eq("modo", config.modo)
    .gte("creado_el", desde);
  const filas = (previos ?? []) as FilaPrevia[];
  const enviadosHoy = filas.filter((p) => p.estado !== "fallido" && fechaBogota(new Date(p.creado_el)) === hoy).length;

  // Respuestas y estado de Meta de cada contacto, en la conversacion de la linea.
  const telefonos = [...new Set(candidatos.map((c) => c.telefono).filter(Boolean))];
  const contactos = new Map<string, { id: string; noApto: boolean }>();
  const respuestas = new Map<string, Set<string>>();
  if (espacioDelAdmin && telefonos.length > 0) {
    const { data: cs } = await admin
      .from("contacts")
      .select("id, wa_id, marketing_opt_out_at")
      .eq("workspace_id", espacioDelAdmin)
      .in("wa_id", telefonos);
    for (const c of cs ?? []) contactos.set(c.wa_id, { id: c.id, noApto: !!c.marketing_opt_out_at });

    const ids = [...contactos.values()].map((c) => c.id);
    if (ids.length > 0) {
      const { data: convs } = await admin.from("conversations").select("id, contact_id").in("contact_id", ids);
      const contactoDe = new Map((convs ?? []).map((c) => [c.id as string, c.contact_id as string]));
      if (contactoDe.size > 0) {
        const { data: taps } = await admin
          .from("messages")
          .select("conversation_id, body")
          .in("conversation_id", [...contactoDe.keys()])
          .eq("direction", "in")
          .eq("message_type", "button")
          .in("body", [RESPUESTA_BAJA, RESPUESTA_VOLVER]);
        for (const t of taps ?? []) {
          const cid = contactoDe.get(t.conversation_id);
          if (!cid) continue;
          if (!respuestas.has(cid)) respuestas.set(cid, new Set());
          respuestas.get(cid)!.add(t.body);
        }
      }
    }
  }

  // Primero se descarta lo que ya salio o esta frenado; DESPUES gana el mas urgente
  // de lo que quede. Al reves, una bienvenida ya enviada taparia el recordatorio
  // de conexion del mismo dia y no saldria ninguno de los dos.
  const decisiones = candidatos.map((c) => {
    const motivo = motivoParaOmitir(c, { config, hoy, previos: filas, contactos, respuestas, ahora });
    return motivo ? { ...c, accion: motivo } : c;
  });
  const ganadora = new Map<string, number>();
  decisiones.forEach((d, i) => {
    if (d.accion !== "enviar") return;
    const actual = ganadora.get(d.workspaceId);
    if (actual === undefined || d.etapa.prio < decisiones[actual].etapa.prio) ganadora.set(d.workspaceId, i);
  });
  decisiones.forEach((d, i) => {
    if (d.accion === "enviar" && ganadora.get(d.workspaceId) !== i) {
      decisiones[i] = { ...d, accion: "Ese día ya sale otro mensaje (uno al día)" };
    }
  });
  return { decisiones, espacioDelAdmin, enviadosHoy };
}

function motivoParaOmitir(
  c: Decision,
  ctx: {
    config: ConfigFidelidad;
    hoy: string;
    ahora: Date;
    previos: FilaPrevia[];
    contactos: Map<string, { id: string; noApto: boolean }>;
    respuestas: Map<string, Set<string>>;
  }
): string | null {
  if (ctx.config.etapasApagadas.includes(c.etapa.clave)) return "Etapa apagada";
  if (!c.telefono) return "Sin teléfono registrado";

  const mios = ctx.previos.filter((p) => p.workspace_id === c.workspaceId);
  if (mios.some((p) => p.etapa === c.etapa.clave && p.periodo === c.periodo && p.estado !== "fallido")) {
    return "Ya enviado en este periodo";
  }
  // Un mensaje al dia por cliente, sea cual sea la etapa.
  if (mios.some((p) => p.estado !== "fallido" && fechaBogota(new Date(p.actualizado_el)) === ctx.hoy)) {
    return "Ya recibió un mensaje hoy";
  }
  // Un fallo se reintenta, pero sin martillar: espera tres horas y se rinde al segundo.
  const fallos = mios.filter((p) => p.etapa === c.etapa.clave && p.periodo === c.periodo && p.estado === "fallido");
  if (fallos.length >= 2) return "Falló dos veces; revisar";
  if (fallos.some((p) => ctx.ahora.getTime() - new Date(p.actualizado_el).getTime() < 3 * 3600_000)) {
    return "Falló hace poco; se reintenta luego";
  }

  const contacto = ctx.contactos.get(c.telefono);
  const dijo = contacto ? ctx.respuestas.get(contacto.id) : undefined;
  // Pedir la baja o decir "voy a volver" frena lo que viene DESPUES del vencimiento.
  const despuesDeVencer = c.etapa.ancla === "vencimiento" && c.etapa.dia !== null && c.etapa.dia > 0;
  if (despuesDeVencer && dijo?.has(RESPUESTA_BAJA)) return "Pidió la baja";
  if (despuesDeVencer && dijo?.has(RESPUESTA_VOLVER)) return "Dijo que va a volver";
  if (c.etapa.categoria === "MARKETING" && contacto?.noApto) return "No apta para Marketing (Meta)";
  return null;
}

/**
 * Frenos que dependen del momento: la calidad de la linea y el tope del dia.
 *
 * Aparte de `planificar` porque la calidad se consulta a Meta y no tiene
 * sentido hacerlo si no hay nada que enviar. Funcion pura: el trabajo y la
 * pantalla del Admin la usan igual, asi lo que se ve es lo que va a pasar.
 */
export function aplicarFrenos(
  decisiones: Decision[],
  ctx: { calidad: string | null | undefined; enviadosHoy: number; tope: number }
): Decision[] {
  let restantes = Math.max(0, ctx.tope - ctx.enviadosHoy);
  // Primero lo mas urgente: si el tope se agota, que se quede sin enviar lo menos importante.
  const orden = decisiones
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.etapa.prio - b.d.etapa.prio || a.i - b.i);
  const resultado = [...decisiones];
  for (const { d, i } of orden) {
    if (d.accion !== "enviar") continue;
    const freno = frenoDeCalidad(ctx.calidad, d.etapa.categoria);
    if (freno) {
      resultado[i] = { ...d, accion: freno };
      continue;
    }
    if (restantes <= 0) {
      resultado[i] = { ...d, accion: "Tope diario alcanzado" };
      continue;
    }
    restantes--;
  }
  return resultado;
}

/** Calidad que reporta Meta para la linea, o null si no se pudo consultar. */
export async function calidadDeLaLinea(admin: SupabaseClient, whatsappAccountId: string): Promise<string | null> {
  const { data: cuenta } = await admin
    .from("whatsapp_accounts")
    .select("phone_number_id, access_token")
    .eq("id", whatsappAccountId)
    .maybeSingle();
  if (!cuenta) return null;
  try {
    const estado = await getPhoneNumberStatus(cuenta.phone_number_id, cuenta.access_token);
    return estado.quality_rating ?? null;
  } catch {
    return null;
  }
}

/** El contacto del cliente en el chat de la linea, creandolo si no existe. */
async function contactoEnLaLinea(admin: SupabaseClient, espacioDelAdmin: string, telefono: string, nombre: string) {
  const { data: existente } = await admin
    .from("contacts")
    .select("id")
    .eq("workspace_id", espacioDelAdmin)
    .eq("wa_id", telefono)
    .maybeSingle();
  if (existente) return existente.id as string;
  const { data: nuevo } = await admin
    .from("contacts")
    .insert({ workspace_id: espacioDelAdmin, wa_id: telefono, name: nombre })
    .select("id")
    .single();
  return (nuevo?.id as string | undefined) ?? null;
}

/** Evita que un token o un cuerpo de error enorme termine guardado en la tabla. */
const recortar = (t: string) => t.slice(0, 300);

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ResumenDeCorrida = { enviados: number; fallidos: number; omitidos: number; calidad: string | null };

let corriendo = false;

/**
 * El trabajo de fondo: corre cada pocos minutos y solo hace algo dentro de la
 * ventana de envio. Reserva cada envio antes de hacerlo, asi que dos procesos
 * a la vez no pueden mandar el mismo mensaje dos veces.
 */
export async function procesarFidelidad(
  ahora: Date = new Date(),
  opciones: { pausaMs?: number } = {}
): Promise<ResumenDeCorrida | null> {
  // Una corrida lenta (hay pausas entre envios) no debe solaparse con la siguiente.
  if (corriendo) return null;
  corriendo = true;
  try {
    return await correr(ahora, opciones.pausaMs ?? PAUSA_ENTRE_ENVIOS_MS);
  } finally {
    corriendo = false;
  }
}

async function correr(ahora: Date, pausaMs: number): Promise<ResumenDeCorrida | null> {
  const admin = createAdminClient();
  const config = await leerConfigFidelidad(admin);
  if (!config.activo || !config.whatsappAccountId) return null;
  if (config.modo === "prueba" && digitos(config.telefonoPrueba).length < 8) return null;

  const { data: cuenta } = await admin
    .from("whatsapp_accounts")
    .select("id, workspace_id, phone_number_id, access_token, status")
    .eq("id", config.whatsappAccountId)
    .maybeSingle();
  if (!cuenta || cuenta.status === "frozen") {
    console.error("fidelidad: la línea elegida no está disponible");
    return null;
  }

  const plan = await planificar(admin, ahora, config);
  // Fuera del horario solo salen las etapas inmediatas; el resto espera a las 9:00.
  if (!dentroDeLaVentana(ahora)) {
    plan.decisiones = plan.decisiones.map((d) =>
      d.accion === "enviar" && !puedeSalirAhora(d.etapa, ahora) ? { ...d, accion: "Fuera del horario de envío" } : d
    );
    if (!plan.decisiones.some((d) => d.accion === "enviar")) return null;
  }
  // La calidad solo se consulta si hay algo que enviar.
  const hayQueEnviar = plan.decisiones.some((d) => d.accion === "enviar");
  const calidad = hayQueEnviar ? await calidadDeLaLinea(admin, config.whatsappAccountId) : null;
  const decisiones = aplicarFrenos(plan.decisiones, { calidad, enviadosHoy: plan.enviadosHoy, tope: config.topeDiario });
  const resumen: ResumenDeCorrida = { enviados: 0, fallidos: 0, omitidos: 0, calidad };

  let primero = true;
  for (const d of decisiones) {
    if (d.accion !== "enviar") {
      resumen.omitidos++;
      continue;
    }

    // Espaciados: que 15 avisos no salgan en el mismo segundo. La pausa va ANTES
    // de reservar: si el proceso se cae durante la espera, no queda una reserva
    // huerfana que bloquee ese envio para siempre.
    if (!primero && pausaMs > 0) await dormir(pausaMs);
    primero = false;

    const { data: reserva, error: errorReserva } = await admin
      .from("fidelidad_envios")
      .insert({
        workspace_id: d.workspaceId,
        workspace_nombre: d.negocio,
        etapa: d.etapa.clave,
        periodo: d.periodo,
        modo: config.modo,
        estado: "enviando",
      })
      .select("id")
      .single();
    // 23505 = otro proceso se adelanto; no es un error.
    if (errorReserva || !reserva) {
      if (errorReserva?.code !== "23505") console.error("fidelidad: no se pudo reservar", errorReserva?.message);
      resumen.omitidos++;
      continue;
    }

    const destino = config.modo === "prueba" ? digitos(config.telefonoPrueba) : d.telefono;
    try {
      const r = await sendTemplateMessage(cuenta.phone_number_id, cuenta.access_token, destino, d.etapa.plantilla, "es", d.parametros);
      const waMessageId = r.messages[0]?.id ?? null;
      await admin
        .from("fidelidad_envios")
        .update({ estado: "enviado", wa_message_id: waMessageId, actualizado_el: new Date().toISOString() })
        .eq("id", reserva.id);
      resumen.enviados++;
      if (config.modo === "real") await guardarEnElChat(admin, cuenta, d, destino, waMessageId, null);
    } catch (err) {
      const mensaje = recortar(err instanceof Error ? err.message : String(err));
      await admin
        .from("fidelidad_envios")
        .update({ estado: "fallido", error: mensaje, actualizado_el: new Date().toISOString() })
        .eq("id", reserva.id);
      resumen.fallidos++;
      if (config.modo === "real") await guardarEnElChat(admin, cuenta, d, destino, null, mensaje);
    }
  }

  if (resumen.enviados + resumen.fallidos > 0) {
    console.log(
      `fidelidad: ${resumen.enviados} enviados, ${resumen.fallidos} fallidos, ${resumen.omitidos} omitidos (${config.modo}, calidad ${calidad ?? "?"})`
    );
  }
  return resumen;
}

async function guardarEnElChat(
  admin: SupabaseClient,
  cuenta: { id: string; workspace_id: string },
  d: Decision,
  destino: string,
  waMessageId: string | null,
  error: string | null
) {
  try {
    const contactoId = await contactoEnLaLinea(admin, cuenta.workspace_id, destino, d.negocio);
    if (!contactoId) return;
    const conversacion = await abrirConversacion(admin, cuenta.workspace_id, contactoId, cuenta.id);
    if (!conversacion) return;
    await recordOutboundMessage(admin, {
      conversationId: conversacion.id,
      messageType: "template",
      body: cuerpoRenderizado(d.etapa, d.parametros),
      waMessageId,
      buttons: d.etapa.botones,
      // Es un aviso de la cuenta, no una venta: que no cuente para seguimientos.
      excludeFromFollowups: true,
      status: error ? "failed" : "sent",
      errorDetail: error,
    });
  } catch (err) {
    // El mensaje ya salio (o ya fallo y quedo en fidelidad_envios); que no se
    // guarde en el chat no debe tumbar el resto de la corrida.
    console.error("fidelidad: no se pudo guardar en el chat", err);
  }
}
