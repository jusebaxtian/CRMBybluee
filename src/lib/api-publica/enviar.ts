import type { SupabaseClient } from "@supabase/supabase-js";
import { ErrorDeMeta, sendTemplateMessage, sendTextMessage } from "@/lib/whatsapp/graph";
import { abrirConversacion } from "@/lib/whatsapp/conversacion";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { isWindowOpen } from "@/lib/whatsapp/message-window";
import { recordOutboundMessage } from "@/lib/messaging/record";
import { buildTemplateSendParams } from "@/lib/whatsapp/variables";
import { noSePuedeUsar, motivoDelExceso } from "@/lib/whatsapp/limite-plantilla";
import { contactoPorTelefono, telefonoValido } from "@/lib/api-publica/contactos";
import type { CodigoError } from "@/lib/api-publica/respuestas";

export const MAX_TEXTO_MENSAJE = 4096;

export type EntradaMensaje = {
  /** Telefono con codigo de pais; el contacto se crea si no existe. */
  telefono?: unknown;
  /** O el id de un contacto que ya existe. */
  contacto_id?: unknown;
  /** Texto libre: solo dentro de las 24 horas desde el ultimo mensaje del cliente. */
  texto?: unknown;
  /** O una plantilla aprobada, que sirve en cualquier momento. */
  plantilla?: unknown;
  /** Linea de WhatsApp desde la que sale; sin ella, la de la conversacion o la primera. */
  linea_id?: unknown;
  /** Si es true, este mensaje cuenta para los seguimientos automaticos. Por defecto no. */
  seguimientos?: unknown;
};

export type DatosEnvio = {
  id: string | null;
  estado: "sent";
  tipo: "texto" | "plantilla";
  contacto_id: string;
  conversacion_id: string;
  linea_id: string | null;
  contacto_creado: boolean;
};

export type ResultadoEnvio = { ok: true; datos: DatosEnvio } | { ok: false; codigo: CodigoError; mensaje: string; extra?: Record<string, unknown> };

const falla = (codigo: CodigoError, mensaje: string, extra?: Record<string, unknown>): ResultadoEnvio => ({ ok: false, codigo, mensaje, extra });

/** Meta rechaza saltos de linea y espacios repetidos dentro de una variable. */
function limpiarVariable(valor: string): string {
  return valor.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

type PlantillaFila = {
  id: string;
  meta_template_name: string;
  language: string;
  category: string | null;
  status: string;
  body_text: string | null;
  variable_count: number | null;
  variables_origen: { origen: "nombre" | "variable2" | "variable3" | "variable4" }[] | null;
  buttons: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  header_format: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  header_media_url: string | null;
  waba_id: string;
};

/**
 * Envia un mensaje por la API. Usa las mismas piezas que el CRM (conversacion,
 * cuenta de envio, registro del mensaje), asi que lo enviado aparece en la
 * bandeja como cualquier otro y respeta las mismas reglas de WhatsApp.
 */
export async function enviarMensajeApi(admin: SupabaseClient, workspaceId: string, entrada: EntradaMensaje): Promise<ResultadoEnvio> {
  const tieneTexto = entrada.texto !== undefined && entrada.texto !== null;
  const tienePlantilla = entrada.plantilla !== undefined && entrada.plantilla !== null;
  if (tieneTexto === tienePlantilla) {
    return falla("peticion_invalida", "Envía «texto» o «plantilla» (uno de los dos, no ambos).");
  }

  // --- Contacto -----------------------------------------------------------
  let contactoId: string;
  let contactoCreado = false;
  if (entrada.contacto_id !== undefined && entrada.contacto_id !== null) {
    if (typeof entrada.contacto_id !== "string") return falla("peticion_invalida", "«contacto_id» debe ser un texto.");
    const { data } = await admin.from("contacts").select("id").eq("id", entrada.contacto_id).eq("workspace_id", workspaceId).maybeSingle();
    if (!data) return falla("no_encontrado", "No existe un contacto con ese «contacto_id» en tu cuenta.");
    contactoId = data.id;
  } else {
    const telefono = telefonoValido(entrada.telefono);
    if (!telefono) return falla("peticion_invalida", "Falta «telefono» o no es válido. Usa el número con código de país, por ejemplo 573001234567.");
    const r = await contactoPorTelefono(admin, workspaceId, telefono);
    if (!r.contacto) return falla("conflicto", r.error ?? "No se pudo crear el contacto.");
    contactoId = r.contacto.id;
    contactoCreado = r.creado;
  }

  const { data: contacto } = await admin
    .from("contacts")
    .select("id, wa_id, name, variable2, variable3, variable4, marketing_opt_out_at")
    .eq("id", contactoId)
    .single();
  if (!contacto) return falla("no_encontrado", "No se encontró el contacto.");

  // --- Linea elegida ------------------------------------------------------
  let lineaElegida: { id: string; waba_id: string | null } | null = null;
  if (entrada.linea_id !== undefined && entrada.linea_id !== null) {
    if (typeof entrada.linea_id !== "string") return falla("peticion_invalida", "«linea_id» debe ser un texto.");
    const { data } = await admin
      .from("whatsapp_accounts")
      .select("id, waba_id, status")
      .eq("id", entrada.linea_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!data || data.status === "frozen") return falla("sin_linea", "Esa línea no existe en tu cuenta o está desconectada. Consulta GET /api/v1/lineas.");
    lineaElegida = { id: data.id, waba_id: data.waba_id };
  }

  // --- Plantilla ----------------------------------------------------------
  let plantilla: PlantillaFila | null = null;
  let bodyParams: string[] | undefined;
  let botonUrl: { index: number; value: string } | undefined;
  if (tienePlantilla) {
    const p = entrada.plantilla;
    if (!p || typeof p !== "object" || Array.isArray(p)) return falla("peticion_invalida", "«plantilla» debe ser un objeto con «nombre».");
    const { nombre, idioma, variables, boton_url } = p as { nombre?: unknown; idioma?: unknown; variables?: unknown; boton_url?: unknown };
    if (typeof nombre !== "string" || !nombre) return falla("peticion_invalida", "Falta «plantilla.nombre».");

    let q = admin
      .from("templates")
      .select("id, meta_template_name, language, category, status, body_text, variable_count, variables_origen, buttons, header_format, header_media_url, waba_id")
      .eq("workspace_id", workspaceId)
      .eq("meta_template_name", nombre);
    if (typeof idioma === "string" && idioma) q = q.eq("language", idioma);
    const { data: candidatas } = await q;
    const lista = (candidatas ?? []) as PlantillaFila[];
    if (lista.length === 0) return falla("no_encontrado", `No existe la plantilla «${nombre}». Consulta GET /api/v1/plantillas.`);
    // Si hay varias (otra linea u otro idioma), gana la de la linea elegida y la aprobada.
    plantilla =
      lista.find((t) => t.status === "APPROVED" && (!lineaElegida || !t.waba_id || t.waba_id === lineaElegida.waba_id)) ??
      lista.find((t) => t.status === "APPROVED") ??
      lista[0];
    if (plantilla.status !== "APPROVED") return falla("peticion_invalida", `La plantilla «${nombre}» todavía no está aprobada por Meta (estado: ${plantilla.status}).`);
    if (noSePuedeUsar(plantilla.body_text)) return falla("peticion_invalida", `Esta plantilla no se puede enviar. ${motivoDelExceso(plantilla.body_text ?? "")}`);
    if (lineaElegida && plantilla.waba_id && plantilla.waba_id !== lineaElegida.waba_id) {
      return falla("sin_linea", "Esa plantilla no pertenece a la línea elegida.");
    }
    if (!lineaElegida && plantilla.waba_id) {
      const { data: linea } = await admin
        .from("whatsapp_accounts")
        .select("id, waba_id")
        .eq("workspace_id", workspaceId)
        .eq("waba_id", plantilla.waba_id)
        .neq("status", "frozen")
        .order("connected_at")
        .limit(1)
        .maybeSingle();
      if (!linea) return falla("sin_linea", "No hay una línea conectada para esa plantilla.");
      lineaElegida = { id: linea.id, waba_id: linea.waba_id };
    }
    if (plantilla.category === "MARKETING" && contacto.marketing_opt_out_at) {
      return falla("conflicto", "Esta persona pidió no recibir mensajes de marketing de tu negocio, así que no se le puede enviar esta plantilla.");
    }

    const automaticos = buildTemplateSendParams(plantilla, contacto);
    const cuantas = plantilla.variable_count ?? 0;
    if (variables !== undefined && variables !== null) {
      if (!Array.isArray(variables) || variables.some((v) => typeof v !== "string" && typeof v !== "number")) {
        return falla("peticion_invalida", "«plantilla.variables» debe ser una lista de textos, en el orden de {{1}}, {{2}}…");
      }
      if (variables.length !== cuantas) {
        return falla("peticion_invalida", `La plantilla lleva ${cuantas} variable(s) y enviaste ${variables.length}.`, { variables_esperadas: cuantas });
      }
      const limpias = variables.map((v) => limpiarVariable(String(v)));
      if (limpias.some((v) => !v)) return falla("peticion_invalida", "Ninguna variable puede ir vacía.");
      bodyParams = limpias;
    } else {
      if (automaticos.sinEmparejar) {
        return falla("peticion_invalida", `La plantilla lleva ${cuantas} variables: envíalas en «plantilla.variables».`, { variables_esperadas: cuantas });
      }
      if (automaticos.faltan.length > 0) {
        return falla("peticion_invalida", "Al contacto le falta un dato que la plantilla necesita. Envíalo en «plantilla.variables» o completa el contacto.", {
          variables_esperadas: cuantas,
        });
      }
      bodyParams = automaticos.bodyParams;
    }
    botonUrl = automaticos.buttonUrlParam;
    if (botonUrl && typeof boton_url === "string" && boton_url.trim()) botonUrl = { index: botonUrl.index, value: limpiarVariable(boton_url) };
  } else {
    if (typeof entrada.texto !== "string" || !entrada.texto.trim()) return falla("peticion_invalida", "«texto» no puede ir vacío.");
    if (entrada.texto.length > MAX_TEXTO_MENSAJE) return falla("peticion_invalida", `«texto» no puede pasar de ${MAX_TEXTO_MENSAJE} caracteres.`);
  }

  // --- Conversacion y cuenta de envio -------------------------------------
  const conversacion = await abrirConversacion(admin, workspaceId, contactoId, lineaElegida?.id ?? null);
  if (!conversacion) return falla("error_interno", "No se pudo abrir la conversación.");
  const cuenta = await resolveSendAccount(admin, workspaceId, conversacion.whatsapp_account_id);
  if (!cuenta) return falla("sin_linea", "Tu cuenta no tiene una línea de WhatsApp conectada.");

  const excluirDeSeguimientos = entrada.seguimientos !== true;

  try {
    if (!plantilla) {
      // Texto libre: solo con la ventana de 24 horas abierta.
      const { data: ultimo } = await admin
        .from("messages")
        .select("created_at")
        .eq("conversation_id", conversacion.id)
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!isWindowOpen((ultimo?.created_at as string | undefined) ?? null, Date.now())) {
        return falla(
          "ventana_cerrada",
          "Pasaron más de 24 horas desde el último mensaje del cliente (o nunca ha escrito). Envía una plantilla aprobada para abrir la conversación.",
          { contacto_id: contactoId }
        );
      }
      const texto = entrada.texto as string;
      const r = await sendTextMessage(cuenta.phone_number_id, cuenta.access_token, contacto.wa_id, texto);
      const waId = r.messages[0]?.id ?? null;
      await recordOutboundMessage(admin, { conversationId: conversacion.id, messageType: "text", body: texto, waMessageId: waId, excludeFromFollowups: excluirDeSeguimientos });
      return { ok: true, datos: { id: waId, estado: "sent", tipo: "texto", contacto_id: contactoId, conversacion_id: conversacion.id, linea_id: cuenta.id, contacto_creado: contactoCreado } };
    }

    const encabezado =
      plantilla.header_format && plantilla.header_format !== "TEXT" && plantilla.header_media_url
        ? { type: plantilla.header_format.toLowerCase() as "image" | "video" | "document", link: plantilla.header_media_url }
        : undefined;
    const r = await sendTemplateMessage(cuenta.phone_number_id, cuenta.access_token, contacto.wa_id, plantilla.meta_template_name, plantilla.language, bodyParams, encabezado, botonUrl);
    const waId = r.messages[0]?.id ?? null;
    const cuerpo = (plantilla.body_text ?? `[Plantilla: ${plantilla.meta_template_name}]`).replace(/\{\{(\d+)\}\}/g, (_, n: string) => bodyParams?.[Number(n) - 1] ?? "");
    await recordOutboundMessage(admin, {
      conversationId: conversacion.id,
      messageType: encabezado ? encabezado.type : "template",
      body: cuerpo,
      mediaUrl: encabezado?.link ?? null,
      waMessageId: waId,
      buttons: plantilla.buttons ?? null,
      excludeFromFollowups: excluirDeSeguimientos,
    });
    return { ok: true, datos: { id: waId, estado: "sent", tipo: "plantilla", contacto_id: contactoId, conversacion_id: conversacion.id, linea_id: cuenta.id, contacto_creado: contactoCreado } };
  } catch (err) {
    if (err instanceof ErrorDeMeta) {
      return falla("error_whatsapp", err.message, { codigo_meta: err.codigo });
    }
    throw err;
  }
}
