"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/with-workspace";
import type { createClient } from "@/lib/supabase/server";
import { textoDeConfirmacion } from "@/lib/agenda/mensaje-cita";
import { notaDeCita, plantillaDeCitaPara } from "@/lib/agenda/nota-de-cita";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnabledModuleKeys } from "@/lib/entitlements";
import { abrirConversacion } from "@/lib/whatsapp/conversacion";
import { MENSAJE_VENCIDA, accesoDeConexion, conexionDelUsuario, conexionPorId } from "@/lib/integraciones/google/acceso";
import {
  ConexionVencidaError,
  actualizarEvento as actualizarEnGoogle,
  borrarEvento as borrarEnGoogle,
  choquesCon,
  crearEvento as crearEnGoogle,
  rangosOcupados,
} from "@/lib/integraciones/google/calendario";
import { MODULO_GOOGLE_CALENDAR } from "@/lib/integraciones/google/contexto";
import { bogotaAIso, sumarMinutos } from "@/lib/agenda/tiempo";
import { normalizarCorreos } from "@/lib/agenda/correos";
import { MENSAJE_MODO_SOPORTE, contextoDeCita } from "@/lib/agenda/contexto-de-cita";
import { sendMessage } from "@/app/actions/whatsapp";
import { isWindowOpen } from "@/lib/whatsapp/message-window";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { sendTemplateMessage } from "@/lib/whatsapp/graph";
import { recordOutboundMessage } from "@/lib/messaging/record";
import { rellenarPlantilla } from "@/lib/ai/seguimientos";
import { IDIOMA_CITA, asegurarPlantillasDeCita, codigoDeMeet, elegirPlantillaGuardada, nombresDePlantilla, parametrosDeCita } from "@/lib/agenda/plantillas-cita";

/**
 * Eventos de la Agenda (migracion 0146). Cada evento se crea tambien en el
 * Google Calendar de quien lo programa, con invitacion por correo y link de
 * Meet si se pide. Si Google falla, no queda un evento a medias en el CRM.
 */

const MENSAJE_SIN_GOOGLE = "Conecta tu Google Calendar en Configuración → Integraciones para programar citas.";

/** La linea elegida en Integraciones para los mensajes de las citas, o null = la del chat del contacto. */
async function lineaDeCitas(supabase: Parameters<typeof getEnabledModuleKeys>[0], workspaceId: string): Promise<string | null> {
  const { data } = await supabase.from("agenda_ajustes").select("whatsapp_account_id").eq("workspace_id", workspaceId).maybeSingle();
  const id = (data?.whatsapp_account_id as string | null | undefined) ?? null;
  if (!id) return null;
  // Si la linea se desconecto o se congelo, se vuelve al comportamiento normal.
  const { data: linea } = await supabase.from("whatsapp_accounts").select("id, status").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  return linea && linea.status !== "frozen" ? id : null;
}

async function moduloIncluidoEnPlan(supabase: Parameters<typeof getEnabledModuleKeys>[0], workspaceId: string) {
  return (await getEnabledModuleKeys(supabase, workspaceId)).includes(MODULO_GOOGLE_CALENDAR);
}

export type EventoAgenda = {
  id: string;
  titulo: string;
  descripcion: string | null;
  inicio: string;
  fin: string;
  invitado_email: string | null;
  invitados: string[];
  con_meet: boolean;
  meet_url: string | null;
  estado: "confirmado" | "cancelado";
  cancelado_desde: "crm" | "google" | null;
  conversation_id: string | null;
  contact_id: string;
  contacto: string;
};

type Entrada = {
  contactId: string;
  titulo: string;
  descripcion?: string;
  inicioLocal: string;
  duracionMin: number;
  invitadoEmail?: string;
  /** Todos los invitados (varios correos). Si falta, se usa `invitadoEmail`. */
  invitadosEmails?: string[];
  conMeet: boolean;
};

function validar(e: Pick<Entrada, "titulo" | "inicioLocal" | "duracionMin" | "invitadoEmail" | "invitadosEmails">):
  | { error: string }
  | { titulo: string; inicioIso: string; finIso: string; emails: string[] } {
  const titulo = e.titulo.trim();
  if (!titulo) return { error: "Escribe un título para la cita." };
  if (titulo.length > 200) return { error: "El título puede tener máximo 200 caracteres." };
  const inicioIso = bogotaAIso(e.inicioLocal);
  if (!inicioIso) return { error: "Elige fecha y hora." };
  if (!Number.isFinite(e.duracionMin) || e.duracionMin < 5 || e.duracionMin > 24 * 60) {
    return { error: "La duración debe estar entre 5 minutos y 24 horas." };
  }
  const correos = normalizarCorreos(e.invitadosEmails ?? (e.invitadoEmail ? [e.invitadoEmail] : []));
  if ("error" in correos) return { error: correos.error };
  return { titulo, inicioIso, finIso: sumarMinutos(inicioIso, Math.round(e.duracionMin)), emails: correos.correos };
}

/** ¿Ya tiene algo a esa hora? Solo ocupado/libre, sin detalles. */
export async function consultarDisponibilidad(input: { inicioLocal: string; duracionMin: number }) {
  const inicioIso = bogotaAIso(input.inicioLocal);
  if (!inicioIso || !(input.duracionMin >= 5)) return { ocupado: false as const };
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { ocupado: false as const };
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) return { ocupado: false as const };
  const conexion = await conexionDelUsuario(user.id);
  if (!conexion) return { ocupado: false as const };
  const acceso = await accesoDeConexion(conexion);
  if ("error" in acceso) return { ocupado: false as const };
  try {
    const finIso = sumarMinutos(inicioIso, input.duracionMin);
    const choques = choquesCon(await rangosOcupados(acceso.token, inicioIso, finIso), inicioIso, finIso);
    return { ocupado: choques.length > 0 };
  } catch {
    return { ocupado: false as const };
  }
}

/** El ultimo correo usado con este contacto, para no pedirlo otra vez. */
export async function ultimoCorreoDeContacto(contactId: string): Promise<string | null> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return null;
  const { data } = await ctx.supabase
    .from("agenda_eventos")
    .select("invitado_email")
    .eq("workspace_id", ctx.workspaceId)
    .eq("contact_id", contactId)
    .not("invitado_email", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.invitado_email as string | null) ?? null;
}

export async function crearEventoAgenda(input: Entrada) {
  const v = validar(input);
  if ("error" in v) return { error: v.error };

  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // En modo soporte la cita se crearia en el Google del administrador, no en el del cliente.
  if ((await contextoDeCita(supabase, workspaceId, user)).modoSoporte) return { error: MENSAJE_MODO_SOPORTE };

  if (!(await moduloIncluidoEnPlan(supabase, workspaceId))) return { error: "Tu plan no incluye Google Calendar." };
  const conexion = await conexionDelUsuario(user.id);
  if (!conexion) return { error: MENSAJE_SIN_GOOGLE };

  const { data: contacto } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", input.contactId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!contacto) return { error: "Contacto no encontrado." };

  const acceso = await accesoDeConexion(conexion);
  if ("error" in acceso) return { error: acceso.error };

  const conversacion = await abrirConversacion(supabase, workspaceId, input.contactId, await lineaDeCitas(supabase, workspaceId));

  const { data: fila, error: errFila } = await supabase
    .from("agenda_eventos")
    .insert({
      workspace_id: workspaceId,
      contact_id: input.contactId,
      conversation_id: conversacion?.id ?? null,
      titulo: v.titulo,
      descripcion: input.descripcion?.trim() || null,
      inicio: v.inicioIso,
      fin: v.finIso,
      invitado_email: v.emails[0] ?? null,
      invitados: v.emails,
      con_meet: input.conMeet,
      conexion_id: conexion.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (errFila || !fila) return { error: "No se pudo guardar la cita." };

  try {
    const creado = await crearEnGoogle(acceso.token, {
      crmEventoId: fila.id as string,
      titulo: v.titulo,
      descripcion: input.descripcion?.trim() || null,
      inicioIso: v.inicioIso,
      finIso: v.finIso,
      invitadosEmails: v.emails,
      conMeet: input.conMeet,
    });
    await supabase.from("agenda_eventos").update({ google_event_id: creado.id, meet_url: creado.meetUrl }).eq("id", fila.id as string);
    revalidatePath("/dashboard/agenda");
    return { success: true as const, id: fila.id as string, meetUrl: creado.meetUrl };
  } catch (err) {
    // Sin cita a medias: si Google no la creo, tampoco queda en el CRM.
    await supabase.from("agenda_eventos").delete().eq("id", fila.id as string);
    console.error("agenda: Google no creó el evento:", err instanceof Error ? err.message : err);
    if (err instanceof ConexionVencidaError) return { error: MENSAJE_VENCIDA };
    return { error: "Google no pudo crear la cita. Intenta de nuevo." };
  }
}

export async function actualizarEventoAgenda(input: {
  id: string;
  titulo: string;
  descripcion?: string;
  inicioLocal: string;
  duracionMin: number;
  invitadoEmail?: string;
  invitadosEmails?: string[];
}) {
  const v = validar(input);
  if ("error" in v) return { error: v.error };
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: actual } = await supabase
    .from("agenda_eventos")
    .select("id, google_event_id, conexion_id, estado")
    .eq("id", input.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!actual) return { error: "Cita no encontrada." };
  if (actual.estado === "cancelado") return { error: "La cita está cancelada." };

  if (actual.google_event_id && actual.conexion_id) {
    const conexion = await conexionPorId(actual.conexion_id as string);
    if (!conexion) return { error: "La conexión con Google de quien creó la cita ya no existe. Cancela la cita y créala de nuevo." };
    const acceso = await accesoDeConexion(conexion);
    if ("error" in acceso) return { error: acceso.error };
    try {
      await actualizarEnGoogle(acceso.token, actual.google_event_id as string, {
        titulo: v.titulo,
        descripcion: input.descripcion?.trim() || null,
        inicioIso: v.inicioIso,
        finIso: v.finIso,
        invitadosEmails: v.emails,
      });
    } catch (err) {
      console.error("agenda: Google no actualizó el evento:", err instanceof Error ? err.message : err);
      return { error: "Google no pudo actualizar la cita. Intenta de nuevo." };
    }
  }

  const { error } = await supabase
    .from("agenda_eventos")
    .update({
      titulo: v.titulo,
      descripcion: input.descripcion?.trim() || null,
      inicio: v.inicioIso,
      fin: v.finIso,
      invitado_email: v.emails[0] ?? null,
      invitados: v.emails,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { error: "No se pudo guardar el cambio." };
  revalidatePath("/dashboard/agenda");
  return { success: true as const };
}

export async function cancelarEventoAgenda(id: string) {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const { data: actual } = await supabase
    .from("agenda_eventos")
    .select("id, google_event_id, conexion_id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!actual) return { error: "Cita no encontrada." };

  if (actual.google_event_id && actual.conexion_id) {
    const conexion = await conexionPorId(actual.conexion_id as string);
    if (conexion) {
      const acceso = await accesoDeConexion(conexion);
      if ("error" in acceso) return { error: acceso.error };
      try {
        await borrarEnGoogle(acceso.token, actual.google_event_id as string);
      } catch (err) {
        console.error("agenda: Google no borró el evento:", err instanceof Error ? err.message : err);
        return { error: "Google no pudo cancelar la cita. Intenta de nuevo." };
      }
    }
  }

  const { error } = await supabase.from("agenda_eventos").update({ estado: "cancelado", cancelado_desde: "crm", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "No se pudo cancelar la cita." };
  revalidatePath("/dashboard/agenda");
  return { success: true as const };
}

export async function listarEventosEntre(desdeIso: string, hastaIso: string): Promise<EventoAgenda[]> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return [];
  const { data } = await ctx.supabase
    .from("agenda_eventos")
    .select("id, titulo, descripcion, inicio, fin, invitado_email, invitados, con_meet, meet_url, estado, cancelado_desde, conversation_id, contact_id, contacts(name, wa_id)")
    .eq("workspace_id", ctx.workspaceId)
    .gte("inicio", desdeIso)
    .lt("inicio", hastaIso)
    .order("inicio");
  return (data ?? []).map((e) => {
    const c = e.contacts as unknown as { name: string | null; wa_id: string } | null;
    return {
      id: e.id as string,
      titulo: e.titulo as string,
      descripcion: (e.descripcion as string | null) ?? null,
      inicio: e.inicio as string,
      fin: e.fin as string,
      invitado_email: (e.invitado_email as string | null) ?? null,
      invitados: ((e.invitados as string[] | null)?.length ? (e.invitados as string[]) : e.invitado_email ? [e.invitado_email as string] : []),
      con_meet: Boolean(e.con_meet),
      meet_url: (e.meet_url as string | null) ?? null,
      estado: e.estado as "confirmado" | "cancelado",
      cancelado_desde: (e.cancelado_desde as "crm" | "google" | null) ?? null,
      conversation_id: (e.conversation_id as string | null) ?? null,
      contact_id: e.contact_id as string,
      contacto: c?.name?.trim() || c?.wa_id || "Contacto",
    };
  });
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Preparada =
  | { error: string; faltaPlantilla?: boolean }
  | { modo: "texto"; para: string; conversacionId: string; texto: string }
  | {
      modo: "plantilla";
      para: string;
      conversacionId: string;
      cuenta: { id: string; phone_number_id: string; access_token: string };
      waId: string;
      nombrePlantilla: string;
      estadoPlantilla: string;
      parametros: string[];
      codigoMeet: string | null;
      cuerpo: string;
    };

/**
 * Decide COMO saldria la confirmacion de una cita (texto libre o plantilla) y arma
 * todo lo necesario, sin enviar nada. Lo usan el envio real y la vista previa, asi
 * lo que se ve antes de enviar es exactamente lo que va a salir.
 */
async function prepararConfirmacionDeCita(supabase: Supabase, workspaceId: string, id: string): Promise<Preparada> {
  const { data: e } = await supabase
    .from("agenda_eventos")
    .select("titulo, inicio, meet_url, estado, contact_id, conversation_id, contacts(name, wa_id)")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!e) return { error: "Cita no encontrada." };
  if (e.estado === "cancelado") return { error: "La cita está cancelada." };

  const contacto = e.contacts as unknown as { name: string | null; wa_id: string } | null;
  if (!contacto) return { error: "Contacto no encontrado." };
  const nombre = contacto.name?.trim();
  const titulo = e.titulo as string;
  const inicioIso = e.inicio as string;
  const meetUrl = (e.meet_url as string | null) ?? null;
  const para = nombre ? `${nombre} (${contacto.wa_id})` : contacto.wa_id;

  // Con una linea elegida en Integraciones el mensaje sale SIEMPRE por ella (y se mira la
  // ventana de 24 h de esa linea); sin elegir, por la del chat de la cita.
  const lineaElegida = await lineaDeCitas(supabase, workspaceId);
  const conversacion = lineaElegida
    ? await abrirConversacion(supabase, workspaceId, e.contact_id as string, lineaElegida)
    : e.conversation_id
      ? (await supabase.from("conversations").select("id, whatsapp_account_id").eq("id", e.conversation_id as string).maybeSingle()).data
      : await abrirConversacion(supabase, workspaceId, e.contact_id as string);
  if (!conversacion) return { error: "No se pudo abrir el chat del contacto." };

  const { data: ultimoEntrante } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversacion.id as string)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Ventana abierta: texto libre.
  if (isWindowOpen((ultimoEntrante?.created_at as string | undefined) ?? null, Date.now())) {
    return { modo: "texto", para, conversacionId: conversacion.id as string, texto: textoDeConfirmacion({ nombre, titulo, inicioIso, meetUrl, nota: notaDeCita(workspaceId, !!meetUrl) }) };
  }

  // Ventana cerrada: plantilla aprobada de ESTA WABA.
  const cuenta = await resolveSendAccount(supabase, workspaceId, conversacion.whatsapp_account_id as string | null);
  if (!cuenta) return { error: "Este workspace no tiene WhatsApp conectado." };
  const { data: linea } = await supabase.from("whatsapp_accounts").select("waba_id").eq("id", cuenta.id).maybeSingle();
  const { data: espacio } = await supabase.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();

  const codigo = codigoDeMeet(meetUrl);
  const plantilla = plantillaDeCitaPara(workspaceId, codigo !== null);
  // El nombre original o un reemplazo (si Meta bloqueo el original tras un borrado): se usa el aprobado.
  const { data: filas } = await supabase
    .from("templates")
    .select("meta_template_name, status, body_text")
    .eq("workspace_id", workspaceId)
    .eq("waba_id", linea?.waba_id ?? "")
    .in("meta_template_name", nombresDePlantilla(plantilla))
    .eq("language", IDIOMA_CITA);
  const fila = elegirPlantillaGuardada((filas ?? []) as { meta_template_name: string; status: string; body_text: string | null }[], plantilla);
  if (!fila) {
    return {
      error: "El contacto no te ha escrito en las últimas 24 horas, así que hay que usar una plantilla, y la de confirmación de citas todavía no existe en tu cuenta de WhatsApp.",
      faltaPlantilla: true,
    };
  }

  const parametros = parametrosDeCita({ contacto: nombre ?? null, empresa: (espacio?.name as string | undefined) ?? "", titulo, inicioIso });
  return {
    modo: "plantilla",
    para,
    conversacionId: conversacion.id as string,
    cuenta,
    waId: contacto.wa_id,
    nombrePlantilla: fila.meta_template_name,
    estadoPlantilla: fila.status,
    parametros,
    codigoMeet: codigo,
    cuerpo: rellenarPlantilla(fila.body_text as string | null, parametros) ?? "",
  };
}

const textoPlantillaEnRevision = (estado: string) =>
  `La plantilla de confirmación está en revisión de Meta (${estado}). Normalmente tarda unos minutos; intenta de nuevo más tarde.`;

/**
 * Lo que se le va a mandar al cliente, para verlo ANTES de enviar: el texto, el
 * boton de Meet si lo lleva y por que via sale (texto libre o plantilla).
 */
export async function vistaPreviaDeConfirmacion(
  id: string
): Promise<
  | { para: string; via: "texto" | "plantilla"; texto: string; boton: string | null; aviso: string | null; puedeEnviar: boolean }
  | { error: string; faltaPlantilla?: boolean }
> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const p = await prepararConfirmacionDeCita(ctx.supabase, ctx.workspaceId, id);
  if ("error" in p) return p;
  if (p.modo === "texto") {
    return { para: p.para, via: "texto", texto: p.texto, boton: null, aviso: null, puedeEnviar: true };
  }
  const aprobada = p.estadoPlantilla === "APPROVED";
  return {
    para: p.para,
    via: "plantilla",
    texto: p.cuerpo,
    boton: p.codigoMeet ? "Ir a la reunión" : null,
    aviso: aprobada
      ? "El cliente no te ha escrito en las últimas 24 horas, así que va como plantilla aprobada por Meta."
      : textoPlantillaEnRevision(p.estadoPlantilla),
    puedeEnviar: aprobada,
  };
}

/**
 * Manda por WhatsApp al contacto el detalle de la cita y el link de Meet.
 * Con la ventana de 24 h abierta va como texto; cerrada, como plantilla aprobada
 * (con el boton "Ir a la reunion" cuando hay Meet).
 */
export async function enviarEnlaceDeCita(id: string): Promise<{ success: true } | { error: string; faltaPlantilla?: boolean }> {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, workspaceId } = ctx;

  const p = await prepararConfirmacionDeCita(supabase, workspaceId, id);
  if ("error" in p) return p;

  if (p.modo === "texto") {
    const r = await sendMessage({ conversationId: p.conversacionId, body: p.texto });
    if ("error" in r && r.error) return { error: r.error };
    return { success: true as const };
  }

  if (p.estadoPlantilla !== "APPROVED") return { error: textoPlantillaEnRevision(p.estadoPlantilla) };

  try {
    const enviado = await sendTemplateMessage(
      p.cuenta.phone_number_id,
      p.cuenta.access_token,
      p.waId,
      p.nombrePlantilla,
      IDIOMA_CITA,
      p.parametros,
      undefined,
      p.codigoMeet ? { index: 0, value: p.codigoMeet } : undefined
    );
    await recordOutboundMessage(supabase, {
      conversationId: p.conversacionId,
      messageType: "template",
      body: p.cuerpo,
      waMessageId: enviado.messages[0]?.id,
      sentBySupport: true,
    });
    revalidatePath(`/dashboard/inbox/${p.conversacionId}`);
    return { success: true as const };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo enviar la plantilla." };
  }
}

/** Crea las plantillas de confirmación de citas en las cuentas de WhatsApp del espacio (si faltan). */
export async function crearPlantillasDeCitaDelEspacio() {
  const ctx = await requireWorkspace();
  if ("error" in ctx) return { error: ctx.error };
  const r = await asegurarPlantillasDeCita(createAdminClient(), ctx.workspaceId);
  if (r.fallos.length > 0 && r.creadas === 0) return { error: "Meta no aceptó la plantilla: " + r.fallos[0] };
  return { success: true as const, creadas: r.creadas };
}

/**
 * Lo que necesita el boton "Nueva cita" del chat: si el plan incluye Google Calendar,
 * si esta persona ya conecto el suyo, y su correo de cuenta (invitado por defecto).
 */
export async function estadoDeAgendaDelUsuario(): Promise<{
  listo: boolean;
  moduloIncluido: boolean;
  requiereReconexion: boolean;
  correo: string | null;
  modoSoporte: boolean;
}> {
  const vacio = { listo: false, moduloIncluido: false, requiereReconexion: false, correo: null, modoSoporte: false };
  const ctx = await requireWorkspace();
  if ("error" in ctx) return vacio;
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!user) return vacio;
  const moduloIncluido = await moduloIncluidoEnPlan(ctx.supabase, ctx.workspaceId);
  const conexion = moduloIncluido ? await conexionDelUsuario(user.id) : null;
  const { correo, modoSoporte } = await contextoDeCita(ctx.supabase, ctx.workspaceId, user);
  return {
    listo: moduloIncluido && !modoSoporte && conexion?.estado === "conectado",
    moduloIncluido,
    requiereReconexion: moduloIncluido && !modoSoporte && conexion?.estado === "requiere_reconexion",
    correo,
    modoSoporte,
  };
}
