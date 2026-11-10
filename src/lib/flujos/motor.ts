import type { createAdminClient } from "@/lib/supabase/admin";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { sendInteractiveButtonsMessage, sendTextMessage } from "@/lib/whatsapp/graph";
import { recordOutboundMessage } from "@/lib/messaging/record";
import {
  ACCION_DE_MEDIA,
  MEDIA_SIN_PIE,
  limitesIa,
  limiteDeBotones,
  puedeReingresar,
  reingresosDeFin,
  salidasDe,
  type DatosBloque,
  type TipoBloque,
} from "@/lib/flujos/bloques";
import { executeAction, type AutomationAction } from "@/lib/automations/engine";
import {
  adjuntosDelAgente,
  agenteParaBloque,
  buildSystemPrompt,
  customerRequestedHuman,
  enviarRespuestaDeIa,
  formatoWhatsApp,
  historialDelChat,
  interpretAiReply,
  seccionesDelVendedor,
  vozDelAgente,
} from "@/lib/ai/agent";
import { callAiProvider } from "@/lib/ai/providers";
import {
  instruccionDeEvaluacion,
  interpretarEvaluacion,
  salidaTrasTurno,
  seccionDeObjetivo,
  transcripcion,
  turnosParaObjetivo,
  type SalidaIa,
} from "@/lib/flujos/ia-objetivo";

type Supabase = ReturnType<typeof createAdminClient>;

/**
 * El motor de Flujos: mueve a un contacto de bloque en bloque.
 *
 * Tres cosas lo despiertan y solo tres: un mensaje entrante, la pulsacion de
 * un boton, o un tiempo que vence. Todo lo demas --que mensaje mandar, a
 * donde seguir-- sale del dibujo que el usuario armo en el lienzo.
 *
 * Reglas que no se negocian, porque cada una nacio de un riesgo real:
 *
 *  - Un contacto esta en un flujo o en ninguno, nunca en dos.
 *  - Mientras esta dentro, las automatizaciones, los seguimientos y la IA no
 *    se meten: si no, el cliente recibe respuestas cruzadas.
 *  - Hay tope de pasos y fecha de vencimiento. Un flujo dibujado en circulo
 *    no puede mandar mensajes para siempre, y un contacto que nunca responde
 *    no puede quedarse "dentro" de por vida.
 */

/** Tope de bloques que puede recorrer una ejecucion. Corta-circuitos de lazos. */
export const MAX_PASOS = 50;

export type NodoFila = { id: string; tipo: TipoBloque; datos: DatosBloque };
export type ConexionFila = { origen_id: string; destino_id: string; salida: string | null };

/** ¿Este contacto esta ahora mismo dentro de algun flujo? */
export async function contactoEnFlujo(supabase: Supabase, contactId: string): Promise<boolean> {
  const { data } = await supabase
    .from("flujo_ejecuciones")
    .select("id")
    .eq("contact_id", contactId)
    .in("estado", ["corriendo", "esperando"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** ¿Este contacto esta ahora conversando con la IA dentro de un flujo? */
export async function contactoEnBloqueDeIa(supabase: Supabase, contactId: string): Promise<boolean> {
  const { data } = await supabase
    .from("flujo_ejecuciones")
    .select("flujo_nodos!flujo_ejecuciones_nodo_id_fkey(tipo)")
    .eq("contact_id", contactId)
    .in("estado", ["corriendo", "esperando"])
    .limit(1)
    .maybeSingle();
  const nodo = data?.flujo_nodos as unknown as { tipo: string } | null | undefined;
  return nodo?.tipo === "ia";
}

async function grafoDelFlujo(supabase: Supabase, flujoId: string) {
  const [{ data: nodos }, { data: conexiones }] = await Promise.all([
    supabase.from("flujo_nodos").select("id, tipo, datos").eq("flujo_id", flujoId),
    supabase.from("flujo_conexiones").select("origen_id, destino_id, salida").eq("flujo_id", flujoId),
  ]);
  return {
    nodos: ((nodos ?? []) as NodoFila[]),
    conexiones: ((conexiones ?? []) as ConexionFila[]),
  };
}

/** A donde lleva una salida concreta de un bloque. null si no esta conectada. */
export function destinoDe(
  conexiones: ConexionFila[],
  nodoId: string,
  salida: string | null
): string | null {
  const c = conexiones.find((x) => x.origen_id === nodoId && (x.salida ?? "sig") === (salida ?? "sig"));
  return c?.destino_id ?? null;
}

/**
 * Ejecuta una accion reutilizando el motor de automatizaciones.
 *
 * Mandar una plantilla, poner una etiqueta, asignar un agente o correr una
 * respuesta rapida ya estan resueltos ahi, con sus detalles feos incluidos
 * (variables de la plantilla, media del encabezado, reparto entre agentes).
 * Reimplementarlo aqui seria tener dos versiones de lo mismo que se separan
 * con el tiempo.
 */
async function ejecutarComoAccion(
  supabase: Supabase,
  workspaceId: string,
  contactId: string,
  accion: Partial<AutomationAction> & { action_type: string }
) {
  const completa: AutomationAction = {
    position: 0,
    action_type: accion.action_type,
    message_body: accion.message_body ?? null,
    tag_id: accion.tag_id ?? null,
    media_url: accion.media_url ?? null,
    media_filename: accion.media_filename ?? null,
    template_id: accion.template_id ?? null,
    quick_reply_id: accion.quick_reply_id ?? null,
    delay_seconds: 0,
    target_agent_id: accion.target_agent_id ?? null,
    agent_distribution: accion.agent_distribution ?? null,
    buttons: accion.buttons ?? null,
    templates: accion.templates ?? null,
  };
  await executeAction(supabase, { id: "flujo", workspace_id: workspaceId }, contactId, completa);
}

/**
 * Reparte el chat por porcentaje (migracion 0170). Solo chats sin asesor y que no
 * sean de un cliente vendido. Un fallo no detiene el flujo: el contacto sigue
 * recibiendo sus mensajes aunque el chat quede sin asignar.
 */
async function repartirChat(
  flujoId: string,
  contactId: string,
  conversationId: string | null,
  reparto: DatosBloque["repartoAgentes"]
) {
  try {
    // Con la llave de servicio: el flujo tambien arranca desde acciones con la
    // sesion de un asesor, que no puede ver ni asignar todos los chats.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const consulta = admin.from("conversations").select("id, assigned_agent_id, vendedor_id");
    const { data: chat } = await (conversationId
      ? consulta.eq("id", conversationId)
      : consulta.eq("contact_id", contactId).order("last_message_at", { ascending: false, nullsFirst: false }).limit(1)
    ).maybeSingle();
    if (!chat || chat.assigned_agent_id || chat.vendedor_id) return;

    const { data: agente, error } = await admin.rpc("flujo_elegir_agente", { p_flujo: flujoId, p_reparto: reparto ?? null });
    if (error) throw new Error(error.message);
    if (!agente) return;

    await admin
      .from("conversations")
      .update({ assigned_agent_id: agente })
      .eq("id", chat.id)
      .is("assigned_agent_id", null)
      .is("vendedor_id", null);
  } catch (err) {
    console.error(`flujo ${flujoId}: no se pudo repartir el chat:`, err);
  }
}

/** Si ya paso por este flujo, ¿el Fin por el que salio la ultima vez lo deja volver? */
async function reingresoPermitido(supabase: Supabase, flujoId: string, contactId: string): Promise<boolean> {
  const { data: anteriores, count } = await supabase
    .from("flujo_ejecuciones")
    .select("reingresos_permitidos", { count: "exact" })
    .eq("flujo_id", flujoId)
    .eq("contact_id", contactId)
    .order("iniciado_el", { ascending: false })
    .limit(1);
  const ultima = anteriores?.[0];
  if (!ultima) return true;
  return puedeReingresar((ultima.reingresos_permitidos as number | null) ?? null, count ?? 0);
}

async function cerrar(
  supabase: Supabase,
  ejecucionId: string,
  estado: "terminado" | "entregado" | "vencido" | "cancelado"
) {
  await supabase
    .from("flujo_ejecuciones")
    .update({ estado, terminado_el: new Date().toISOString(), actualizado_el: new Date().toISOString() })
    .eq("id", ejecucionId);
}

/**
 * Corre la ejecucion desde su bloque actual hasta que tenga que parar.
 *
 * Para cuando: llega a un bloque que espera algo (botones o espera), termina,
 * entrega a la IA, se queda sin salida conectada, o se pasa del tope de pasos.
 */
export async function avanzar(supabase: Supabase, ejecucionId: string): Promise<void> {
  const { data: ejecucion } = await supabase
    .from("flujo_ejecuciones")
    .select("id, flujo_id, workspace_id, contact_id, conversation_id, nodo_id, estado, pasos, vence_el, iniciado_el")
    .eq("id", ejecucionId)
    .maybeSingle();
  if (!ejecucion || !["corriendo", "esperando"].includes(ejecucion.estado as string)) return;

  if (new Date(ejecucion.vence_el as string).getTime() < Date.now()) {
    await cerrar(supabase, ejecucionId, "vencido");
    return;
  }

  const { nodos, conexiones } = await grafoDelFlujo(supabase, ejecucion.flujo_id as string);
  const { data: contacto } = await supabase
    .from("contacts")
    .select("wa_id, marketing_opt_out_at")
    .eq("id", ejecucion.contact_id as string)
    .maybeSingle();
  if (!contacto) {
    await cerrar(supabase, ejecucionId, "cancelado");
    return;
  }
  // Quien pidio no recibir marketing no recibe un flujo: Meta lo rechaza y
  // cada intento pesa contra la calidad del numero.
  if (contacto.marketing_opt_out_at) {
    await cerrar(supabase, ejecucionId, "cancelado");
    return;
  }

  const { data: conversacion } = ejecucion.conversation_id
    ? await supabase
        .from("conversations")
        .select("whatsapp_account_id")
        .eq("id", ejecucion.conversation_id as string)
        .maybeSingle()
    : { data: null };

  // La linea del flujo manda sobre la del hilo: si el flujo es de la linea de
  // ventas, sale por ventas aunque el contacto haya escrito por soporte.
  const { data: flujoDelEnvio } = await supabase
    .from("flujos")
    .select("whatsapp_account_id")
    .eq("id", ejecucion.flujo_id as string)
    .maybeSingle();

  const cuenta = await resolveSendAccount(
    supabase,
    ejecucion.workspace_id as string,
    (flujoDelEnvio?.whatsapp_account_id as string | null) ?? conversacion?.whatsapp_account_id ?? null
  );
  if (!cuenta) {
    await cerrar(supabase, ejecucionId, "cancelado");
    return;
  }

  let nodoActual = nodos.find((n) => n.id === ejecucion.nodo_id);
  let pasos = ejecucion.pasos as number;

  while (nodoActual) {
    pasos += 1;
    if (pasos > MAX_PASOS) {
      console.error(
        `flujo ${ejecucion.flujo_id}: la ejecucion ${ejecucionId} paso de ${MAX_PASOS} bloques — probablemente hay un lazo`
      );
      await cerrar(supabase, ejecucionId, "cancelado");
      return;
    }

    const tipo = nodoActual.tipo;
    const datos = (nodoActual.datos ?? {}) as DatosBloque;

    if (tipo === "fin") {
      // Se guarda la regla en el recorrido y no el id del bloque: guardar el
      // lienzo le cambia el id a todos los bloques.
      await supabase
        .from("flujo_ejecuciones")
        .update({ reingresos_permitidos: reingresosDeFin(datos) })
        .eq("id", ejecucionId);
      await cerrar(supabase, ejecucionId, "terminado");
      return;
    }

    if (tipo === "ia") {
      // La IA se reactiva en este chat, aunque un bloque anterior la haya dejado
      // pausada, y conversa aqui hasta salir por una de sus cuatro salidas.
      if (ejecucion.conversation_id) {
        await supabase
          .from("conversations")
          .update({ ai_manually_paused: false, ai_handoff_requested: false })
          .eq("id", ejecucion.conversation_id as string);
      }
      await supabase
        .from("flujo_ejecuciones")
        .update({ estado: "esperando", nodo_id: nodoActual.id, pasos, ia_respuestas: 0, actualizado_el: new Date().toISOString() })
        .eq("id", ejecucionId);
      await turnoDeIa(supabase, ejecucionId, nodoActual, conexiones, { texto: null, esPrimero: true });
      return;
    }

    if (tipo === "mensaje" || tipo === "inicio") {
      // Archivo adjunto: lo manda el motor de automatizaciones (que ya sabe
      // subirlo, validarlo y guardarlo en el chat). El texto va de pie del
      // archivo, salvo en el audio, que no admite pie: ahi sale aparte.
      const conArchivo = tipo === "mensaje" && !!datos.mediaUrl && !!datos.mediaTipo;
      if (conArchivo && datos.mediaTipo) {
        const pie = datos.mediaTipo === MEDIA_SIN_PIE ? undefined : datos.texto?.trim() || undefined;
        await ejecutarComoAccion(supabase, ejecucion.workspace_id as string, ejecucion.contact_id as string, {
          action_type: ACCION_DE_MEDIA[datos.mediaTipo],
          media_url: datos.mediaUrl,
          media_filename: datos.mediaNombre ?? null,
          message_body: pie ?? null,
        });
      }
      const textoAparte = conArchivo ? datos.mediaTipo === MEDIA_SIN_PIE && !!datos.texto?.trim() : !!datos.texto?.trim();
      if (tipo === "mensaje" && textoAparte && datos.texto) {
        const enviado = await sendTextMessage(
          cuenta.phone_number_id,
          cuenta.access_token,
          contacto.wa_id as string,
          datos.texto.trim()
        );
        if (ejecucion.conversation_id) {
          await recordOutboundMessage(supabase, {
            origen: "flujo",
            conversationId: ejecucion.conversation_id as string,
            messageType: "text",
            body: datos.texto.trim(),
            waMessageId: enviado.messages[0]?.id,
          });
        }
      }

      const siguiente = destinoDe(conexiones, nodoActual.id, "sig");
      if (!siguiente) {
        await cerrar(supabase, ejecucionId, "terminado");
        return;
      }
      nodoActual = nodos.find((n) => n.id === siguiente);
      continue;
    }

    if (tipo === "botones") {
      const botones = (datos.botones ?? [])
        .map((titulo, i) => ({ id: String(i), title: titulo.trim() }))
        .filter((b) => b.title);
      if (botones.length === 0 || !datos.texto?.trim()) {
        await cerrar(supabase, ejecucionId, "cancelado");
        return;
      }

      const enviado = await sendInteractiveButtonsMessage(
        cuenta.phone_number_id,
        cuenta.access_token,
        contacto.wa_id as string,
        datos.texto.trim(),
        botones
      );
      if (ejecucion.conversation_id) {
        await recordOutboundMessage(supabase, {
          origen: "flujo",
          conversationId: ejecucion.conversation_id as string,
          messageType: "text",
          body: datos.texto.trim(),
          waMessageId: enviado.messages[0]?.id,
          buttons: botones.map((b) => ({ type: "QUICK_REPLY", text: b.title })),
        });
      }

      // Queda esperando la pulsacion. Con tiempo limite (opcional), al vencer
      // sigue por "No respondió"; sin el, solo el vencimiento de la ejecucion
      // evita que se quede ahi para siempre.
      await supabase
        .from("flujo_ejecuciones")
        .update({ estado: "esperando", nodo_id: nodoActual.id, pasos, actualizado_el: new Date().toISOString() })
        .eq("id", ejecucionId);
      const limite = limiteDeBotones(datos);
      if (limite) {
        await supabase.from("flujo_esperas").insert({
          ejecucion_id: ejecucionId,
          nodo_id: nodoActual.id,
          vence_el: new Date(Date.now() + limite * 60_000).toISOString(),
        });
      }
      return;
    }

    if (tipo === "esperar") {
      const minutos = Math.max(1, datos.minutos ?? 5);
      await supabase
        .from("flujo_ejecuciones")
        .update({ estado: "esperando", nodo_id: nodoActual.id, pasos, actualizado_el: new Date().toISOString() })
        .eq("id", ejecucionId);
      await supabase.from("flujo_esperas").insert({
        ejecucion_id: ejecucionId,
        nodo_id: nodoActual.id,
        vence_el: new Date(Date.now() + minutos * 60_000).toISOString(),
      });
      return;
    }

    if (tipo === "plantilla") {
      if (!datos.plantillaId) {
        await cerrar(supabase, ejecucionId, "cancelado");
        return;
      }
      const { data: plantilla } = await supabase
        .from("templates")
        .select("meta_template_name, language, body_text, header_format, header_media_url, variable_count, variables_origen, buttons")
        .eq("id", datos.plantillaId)
        .maybeSingle();
      await ejecutarComoAccion(supabase, ejecucion.workspace_id as string, ejecucion.contact_id as string, {
        action_type: "send_template",
        template_id: datos.plantillaId,
        templates: (plantilla ?? null) as AutomationAction["templates"],
      });
      const siguiente = destinoDe(conexiones, nodoActual.id, "sig");
      if (!siguiente) {
        await cerrar(supabase, ejecucionId, "terminado");
        return;
      }
      nodoActual = nodos.find((n) => n.id === siguiente);
      continue;
    }

    if (tipo === "etiqueta" || tipo === "agente" || tipo === "respuesta_rapida") {
      const accion =
        tipo === "etiqueta"
          ? {
              action_type: datos.etiquetaAccion === "quitar" ? "remove_tag" : "add_tag",
              tag_id: datos.etiquetaId ?? null,
            }
          : tipo === "agente"
            ? { action_type: "assign_agent", target_agent_id: datos.agenteId ?? null }
            : { action_type: "send_quick_reply", quick_reply_id: datos.respuestaRapidaId ?? null };

      if (tipo === "agente" && !datos.agenteId) {
        await repartirChat(
          ejecucion.flujo_id as string,
          ejecucion.contact_id as string,
          (ejecucion.conversation_id as string | null) ?? null,
          datos.repartoAgentes
        );
      } else {
        await ejecutarComoAccion(
          supabase,
          ejecucion.workspace_id as string,
          ejecucion.contact_id as string,
          accion
        );
      }

      const siguiente = destinoDe(conexiones, nodoActual.id, "sig");
      if (!siguiente) {
        await cerrar(supabase, ejecucionId, "terminado");
        return;
      }
      nodoActual = nodos.find((n) => n.id === siguiente);
      continue;
    }

    if (tipo === "automatizacion") {
      if (datos.automatizacionId) {
        const { runActionsForAutomation } = await import("@/lib/automations/engine");
        await runActionsForAutomation(
          supabase,
          { id: datos.automatizacionId, workspace_id: ejecucion.workspace_id as string },
          ejecucion.contact_id as string
        );
      }
      const siguiente = destinoDe(conexiones, nodoActual.id, "sig");
      if (!siguiente) {
        await cerrar(supabase, ejecucionId, "terminado");
        return;
      }
      nodoActual = nodos.find((n) => n.id === siguiente);
      continue;
    }

    if (tipo === "condicion") {
      // Hoy la condicion es "¿tiene esta etiqueta?", que es lo que el cliente
      // ya usa para segmentar. Cuando haga falta mas, la salida sigue siendo
      // la misma: si / no.
      let cumple = false;
      if (datos.condicionTagId) {
        const { data } = await supabase
          .from("contact_tags")
          .select("tag_id")
          .eq("contact_id", ejecucion.contact_id as string)
          .eq("tag_id", datos.condicionTagId)
          .maybeSingle();
        cumple = Boolean(data);
      }
      const siguiente = destinoDe(conexiones, nodoActual.id, cumple ? "si" : "no");
      if (!siguiente) {
        await cerrar(supabase, ejecucionId, "terminado");
        return;
      }
      nodoActual = nodos.find((n) => n.id === siguiente);
      continue;
    }

    if (tipo === "saltar") {
      // Este flujo termina y arranca el otro. Se cierra ANTES de iniciar
      // porque un contacto no puede estar en dos flujos a la vez: si se
      // hiciera al reves, el nuevo no arrancaria nunca.
      await cerrar(supabase, ejecucionId, "terminado");
      if (datos.flujoDestinoId) {
        await iniciarFlujo(
          supabase,
          datos.flujoDestinoId,
          ejecucion.contact_id as string,
          (ejecucion.conversation_id as string | null) ?? null
        );
      }
      return;
    }

    // Tipo desconocido (version vieja del dibujo): se cierra en vez de
    // adivinar.
    await cerrar(supabase, ejecucionId, "cancelado");
    return;
  }

  // Se quedo sin bloque: el dibujo tenia una salida colgando.
  await cerrar(supabase, ejecucionId, "terminado");
}

/** Las esperas pendientes de este recorrido ya no aplican. */
async function cancelarEsperas(supabase: Supabase, ejecucionId: string) {
  await supabase
    .from("flujo_esperas")
    .update({ procesada_el: new Date().toISOString() })
    .eq("ejecucion_id", ejecucionId)
    .is("procesada_el", null);
}

/**
 * Lo saca del flujo a mano: no se le envia nada y vuelve a lo normal. Cuenta como
 * cancelado y no como un Fin, asi que despues puede volver a entrar.
 */
export async function sacarDelFlujo(supabase: Supabase, ejecucionId: string) {
  await cancelarEsperas(supabase, ejecucionId);
  await cerrar(supabase, ejecucionId, "cancelado");
}

/**
 * Lo mueve a mano a otro bloque y lo corre desde ahi. Si estaba conversando con la
 * IA, sale igual que por cualquiera de sus salidas: la IA queda pausada en el chat.
 */
export async function forzarAvance(supabase: Supabase, ejecucionId: string, destinoId: string) {
  const { data: ejecucion } = await supabase
    .from("flujo_ejecuciones")
    .select("flujo_id, nodo_id, conversation_id")
    .eq("id", ejecucionId)
    .maybeSingle();
  if (!ejecucion) return;
  const { nodos } = await grafoDelFlujo(supabase, ejecucion.flujo_id as string);
  if (nodos.find((n) => n.id === ejecucion.nodo_id)?.tipo === "ia" && ejecucion.conversation_id) {
    await supabase.from("conversations").update({ ai_manually_paused: true }).eq("id", ejecucion.conversation_id as string);
  }
  await cancelarEsperas(supabase, ejecucionId);
  await irANodo(supabase, ejecucionId, destinoId);
}

/** Mueve la ejecucion a un bloque y la corre. */
async function irANodo(supabase: Supabase, ejecucionId: string, nodoId: string) {
  await supabase
    .from("flujo_ejecuciones")
    .update({ estado: "corriendo", nodo_id: nodoId, actualizado_el: new Date().toISOString() })
    .eq("id", ejecucionId);
  await avanzar(supabase, ejecucionId);
}

/**
 * Sale del bloque de IA: la IA queda pausada en este chat, para que no siga
 * respondiendo sin fin, y el flujo sigue por la salida. Solo otro bloque de IA la
 * vuelve a activar.
 */
async function salirDeIa(
  supabase: Supabase,
  ejecucionId: string,
  nodoId: string,
  conexiones: ConexionFila[],
  conversationId: string | null,
  salida: SalidaIa
) {
  await supabase
    .from("flujo_esperas")
    .update({ procesada_el: new Date().toISOString() })
    .eq("ejecucion_id", ejecucionId)
    .is("procesada_el", null);
  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ ai_manually_paused: true, ...(salida === "humano" ? { ai_handoff_requested: true } : {}) })
      .eq("id", conversationId);
  }
  const destino = destinoDe(conexiones, nodoId, salida);
  if (!destino) {
    await cerrar(supabase, ejecucionId, "terminado");
    return;
  }
  await irANodo(supabase, ejecucionId, destino);
}

/**
 * Un turno de la IA dentro del bloque: responde y decide si sigue esperando al
 * cliente o sale. Si la IA o el envio fallan, sale por "No cumplió": un contacto
 * no puede quedarse esperando a una IA que no va a contestar.
 */
async function turnoDeIa(
  supabase: Supabase,
  ejecucionId: string,
  nodo: NodoFila,
  conexiones: ConexionFila[],
  entrada: { texto: string | null; esPrimero: boolean }
) {
  const { data: ejecucion } = await supabase
    .from("flujo_ejecuciones")
    .select("flujo_id, workspace_id, contact_id, conversation_id, ia_respuestas")
    .eq("id", ejecucionId)
    .maybeSingle();
  if (!ejecucion) return;
  const conversationId = (ejecucion.conversation_id as string | null) ?? null;
  const workspaceId = ejecucion.workspace_id as string;
  const contactId = ejecucion.contact_id as string;
  const salir = (salida: SalidaIa) => salirDeIa(supabase, ejecucionId, nodo.id, conexiones, conversationId, salida);

  if (!conversationId) return salir("no_cumplio");

  const [{ data: chat }, { data: contacto }, { data: flujo }] = await Promise.all([
    supabase.from("conversations").select("whatsapp_account_id, ai_manually_paused, ai_handoff_requested").eq("id", conversationId).maybeSingle(),
    supabase.from("contacts").select("wa_id").eq("id", contactId).maybeSingle(),
    supabase.from("flujos").select("whatsapp_account_id").eq("id", ejecucion.flujo_id as string).maybeSingle(),
  ]);
  if (!chat || !contacto) return salir("no_cumplio");

  // Alguien del equipo tomo el chat mientras la IA conversaba: ella se retira.
  if (!entrada.esPrimero && (chat.ai_manually_paused || chat.ai_handoff_requested)) return salir("humano");

  const linea = (flujo?.whatsapp_account_id as string | null) ?? (chat.whatsapp_account_id as string | null);
  const [cuenta, agente] = await Promise.all([
    resolveSendAccount(supabase, workspaceId, linea),
    agenteParaBloque(supabase, workspaceId, linea),
  ]);
  if (!cuenta || !agente) {
    console.error(`flujo ${ejecucion.flujo_id}: el bloque de IA no tiene ${cuenta ? "llave de IA" : "línea"} para responder`);
    return salir("no_cumplio");
  }

  const datos = (nodo.datos ?? {}) as DatosBloque;
  const { maxRespuestas, minutosEspera } = limitesIa(datos);
  const usadas = (ejecucion.ia_respuestas as number) ?? 0;

  try {
    if (entrada.texto && customerRequestedHuman(entrada.texto)) {
      await enviarRespuestaDeIa(supabase, {
        workspaceId,
        conversationId,
        cuenta,
        waId: contacto.wa_id as string,
        texto: "¡Claro que sí! Ya te conecto con nuestro equipo, en un momento te contactan 🙌",
        mediaKeys: [],
        adjuntos: [],
      });
      return salir("humano");
    }

    const [adjuntos, historial, seccionVendedor] = await Promise.all([
      adjuntosDelAgente(supabase, workspaceId, agente.whatsapp_account_id),
      historialDelChat(supabase, conversationId),
      seccionesDelVendedor(supabase, agente, contactId),
    ]);

    // Primero se evalua, aparte: asi la respuesta ya sabe si debe seguir o despedirse.
    // Si la evaluacion falla, la IA sigue conversando y el tope de respuestas la frena.
    const evaluacion = await callAiProvider(agente.provider, agente.api_key, agente.model, instruccionDeEvaluacion(datos.objetivo), [
      { role: "user", content: transcripcion(historial) || "(todavía no hay conversación)" },
    ]).catch((err) => {
      console.error(`flujo ${ejecucion.flujo_id}: falló la evaluación del objetivo:`, err);
      return "";
    });
    const cumplido = interpretarEvaluacion(evaluacion);

    const instrucciones =
      buildSystemPrompt(datos.nombreAgente?.trim() || agente.agent_name, agente.persona, adjuntos) +
      seccionVendedor +
      seccionDeObjetivo(datos.objetivo, usadas, maxRespuestas, cumplido);
    const crudo = await callAiProvider(agente.provider, agente.api_key, agente.model, instrucciones, turnosParaObjetivo(historial));
    if (!crudo) return salir(cumplido ? "cumplio" : "no_cumplio");

    const { customerReply, handoff, mediaKeys } = interpretAiReply(crudo);

    await enviarRespuestaDeIa(supabase, {
      workspaceId,
      conversationId,
      cuenta,
      waId: contacto.wa_id as string,
      texto: formatoWhatsApp(customerReply),
      mediaKeys,
      adjuntos,
      vozId: vozDelAgente(agente),
      fuentesDeNumeros: "esVendedor" in agente ? `${instrucciones}\n${historial.map((t) => t.content).join("\n")}` : undefined,
    });

    const respuestas = usadas + 1;
    await supabase.from("flujo_ejecuciones").update({ ia_respuestas: respuestas, actualizado_el: new Date().toISOString() }).eq("id", ejecucionId);

    const salida = salidaTrasTurno({ cumplido, handoff, respuestas, maximo: maxRespuestas });
    if (salida) return salir(salida);

    // Sigue conversando: el tiempo de espera vuelve a empezar con cada respuesta.
    await supabase
      .from("flujo_esperas")
      .update({ procesada_el: new Date().toISOString() })
      .eq("ejecucion_id", ejecucionId)
      .is("procesada_el", null);
    await supabase.from("flujo_esperas").insert({
      ejecucion_id: ejecucionId,
      nodo_id: nodo.id,
      vence_el: new Date(Date.now() + minutosEspera * 60_000).toISOString(),
    });
  } catch (err) {
    console.error(`flujo ${ejecucion.flujo_id}: falló el turno de la IA:`, err);
    return salir("no_cumplio");
  }
}

/**
 * Llego algo del contacto mientras estaba dentro de un flujo.
 *
 * Devuelve true si el flujo se hizo cargo: quien llama usa eso para no correr
 * ademas las automatizaciones ni la IA.
 */
export async function procesarEntrada(
  supabase: Supabase,
  contactId: string,
  entrada: { botonId: string | null; texto: string | null; lecturaEnCurso?: Promise<unknown> | null }
): Promise<boolean> {
  const { data: ejecucion } = await supabase
    .from("flujo_ejecuciones")
    .select("id, flujo_id, nodo_id, estado, vence_el")
    .eq("contact_id", contactId)
    .in("estado", ["corriendo", "esperando"])
    .limit(1)
    .maybeSingle();
  if (!ejecucion) return false;

  if (new Date(ejecucion.vence_el as string).getTime() < Date.now()) {
    await cerrar(supabase, ejecucion.id as string, "vencido");
    return false;
  }

  const { nodos, conexiones } = await grafoDelFlujo(supabase, ejecucion.flujo_id as string);
  const nodo = nodos.find((n) => n.id === ejecucion.nodo_id);
  if (!nodo) return false;

  if (nodo.tipo === "botones") {
    const datos = (nodo.datos ?? {}) as DatosBloque;
    const salidas = salidasDe("botones", datos);
    // El id del boton es su posicion; si escribio texto en vez de tocar, se
    // sigue por "otro", que siempre existe.
    const salida = entrada.botonId !== null && salidas.some((s) => s.id === entrada.botonId)
      ? entrada.botonId
      : "otro";
    // Contesto a tiempo: el tiempo limite, si lo tenia, ya no aplica.
    await cancelarEsperas(supabase, ejecucion.id as string);
    const destino = destinoDe(conexiones, nodo.id, salida);
    if (!destino) {
      await cerrar(supabase, ejecucion.id as string, "terminado");
      return true;
    }
    await irANodo(supabase, ejecucion.id as string, destino);
    return true;
  }

  if (nodo.tipo === "ia") {
    // Si mando una foto, la IA debe verla antes de responder.
    await entrada.lecturaEnCurso;
    await turnoDeIa(supabase, ejecucion.id as string, nodo, conexiones, { texto: entrada.texto, esPrimero: false });
    return true;
  }

  if (nodo.tipo === "esperar") {
    // Respondio antes de tiempo: la espera pendiente ya no aplica.
    await supabase
      .from("flujo_esperas")
      .update({ procesada_el: new Date().toISOString() })
      .eq("ejecucion_id", ejecucion.id as string)
      .is("procesada_el", null);

    const destino = destinoDe(conexiones, nodo.id, "respondio");
    if (!destino) {
      await cerrar(supabase, ejecucion.id as string, "terminado");
      return true;
    }
    await irANodo(supabase, ejecucion.id as string, destino);
    return true;
  }

  // En cualquier otro bloque el mensaje no hace avanzar nada, pero el flujo
  // sigue mandando: no se deja pasar a las automatizaciones.
  return true;
}

/** Arranca un flujo para un contacto. Devuelve el id de la ejecucion, o null. */
export async function iniciarFlujo(
  supabase: Supabase,
  flujoId: string,
  contactId: string,
  conversationId: string | null
): Promise<string | null> {
  const { data: flujo } = await supabase
    .from("flujos")
    .select("id, workspace_id, activo, dias_de_vida")
    .eq("id", flujoId)
    .maybeSingle();
  if (!flujo || !flujo.activo) return null;

  // Un contacto, un flujo. Si ya esta en otro, este no arranca.
  if (await contactoEnFlujo(supabase, contactId)) return null;

  // Aqui pasan todas las entradas: disparadores, a mano y "Saltar a otro flujo".
  if (!(await reingresoPermitido(supabase, flujoId, contactId))) return null;

  const { nodos, conexiones } = await grafoDelFlujo(supabase, flujoId);
  const inicio = nodos.find((n) => n.tipo === "inicio");
  if (!inicio) return null;
  const primero = destinoDe(conexiones, inicio.id, "sig");
  if (!primero) return null;

  const dias = (flujo.dias_de_vida as number) || 7;
  const { data: ejecucion, error } = await supabase
    .from("flujo_ejecuciones")
    .insert({
      flujo_id: flujoId,
      workspace_id: flujo.workspace_id,
      contact_id: contactId,
      conversation_id: conversationId,
      nodo_id: primero,
      estado: "corriendo",
      vence_el: new Date(Date.now() + dias * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  // El indice unico puede rechazar la insercion si dos mensajes entran a la
  // vez: es la proteccion funcionando, no un error que reportar.
  if (error || !ejecucion) return null;

  await avanzar(supabase, ejecucion.id as string);
  return ejecucion.id as string;
}

/** Trabajo de fondo: las esperas que ya vencieron siguen por "no respondió". */
export async function procesarEsperasVencidas(supabase: Supabase): Promise<number> {
  const { data: esperas } = await supabase
    .from("flujo_esperas")
    .select("id, ejecucion_id, nodo_id")
    .is("procesada_el", null)
    .lte("vence_el", new Date().toISOString())
    .limit(100);

  let procesadas = 0;
  for (const espera of esperas ?? []) {
    // Se reclama de forma atomica: si dos procesos corren el trabajo a la vez,
    // solo uno se queda con la espera.
    const { data: reclamada } = await supabase
      .from("flujo_esperas")
      .update({ procesada_el: new Date().toISOString() })
      .eq("id", espera.id as string)
      .is("procesada_el", null)
      .select("id")
      .maybeSingle();
    if (!reclamada) continue;

    const { data: ejecucion } = await supabase
      .from("flujo_ejecuciones")
      .select("id, flujo_id, estado, conversation_id")
      .eq("id", espera.ejecucion_id as string)
      .maybeSingle();
    if (!ejecucion || !["corriendo", "esperando"].includes(ejecucion.estado as string)) continue;

    const { nodos, conexiones } = await grafoDelFlujo(supabase, ejecucion.flujo_id as string);
    if (nodos.find((n) => n.id === espera.nodo_id)?.tipo === "ia") {
      await salirDeIa(
        supabase,
        ejecucion.id as string,
        espera.nodo_id as string,
        conexiones,
        (ejecucion.conversation_id as string | null) ?? null,
        "no_respondio"
      );
      procesadas += 1;
      continue;
    }

    const destino = destinoDe(conexiones, espera.nodo_id as string, "no_respondio");
    if (!destino) {
      await cerrar(supabase, ejecucion.id as string, "terminado");
      procesadas += 1;
      continue;
    }

    await irANodo(supabase, ejecucion.id as string, destino);
    procesadas += 1;
  }

  return procesadas;
}

/** Trabajo de fondo: cierra las ejecuciones a las que se les acabo el plazo. */
export async function cerrarEjecucionesVencidas(supabase: Supabase): Promise<number> {
  const { data } = await supabase
    .from("flujo_ejecuciones")
    .update({ estado: "vencido", terminado_el: new Date().toISOString(), actualizado_el: new Date().toISOString() })
    .in("estado", ["corriendo", "esperando"])
    .lte("vence_el", new Date().toISOString())
    .select("id");
  return (data ?? []).length;
}

/**
 * Busca que flujo arrancar con lo que acaba de llegar.
 *
 * Se llama solo cuando el contacto NO esta ya dentro de un flujo. Si varios
 * flujos coinciden gana el mas reciente: es el que el cliente acaba de armar,
 * y casi siempre el que quiere probar.
 */
export async function iniciarPorMensaje(
  supabase: Supabase,
  workspaceId: string,
  contactId: string,
  conversationId: string | null,
  entrada: { texto: string | null; esPrimeroDelDia: boolean; whatsappAccountId?: string | null }
): Promise<boolean> {
  const { data: flujos } = await supabase
    .from("flujos")
    .select("id, updated_at, whatsapp_account_id, flujo_disparadores(tipo, valor)")
    .eq("workspace_id", workspaceId)
    .eq("activo", true)
    .order("updated_at", { ascending: false });

  const texto = (entrada.texto ?? "").toLowerCase();

  for (const flujo of flujos ?? []) {
    // Un flujo atado a una linea no arranca con un mensaje que llego por otra:
    // el contacto que escribe a soporte no debe caer en el flujo de ventas.
    const lineaDelFlujo = flujo.whatsapp_account_id as string | null;
    if (lineaDelFlujo && entrada.whatsappAccountId && lineaDelFlujo !== entrada.whatsappAccountId) continue;

    const disparadores = (flujo.flujo_disparadores ?? []) as { tipo: string; valor: string | null }[];
    const coincide = disparadores.some((d) => {
      if (d.tipo === "any_message") return true;
      if (d.tipo === "first_message_of_day") return entrada.esPrimeroDelDia;
      if (d.tipo === "keyword") {
        const palabra = (d.valor ?? "").trim().toLowerCase();
        return Boolean(palabra) && texto.includes(palabra);
      }
      // "tag" y "manual" no entran por mensaje.
      return false;
    });
    if (!coincide) continue;

    const ejecucion = await iniciarFlujo(supabase, flujo.id as string, contactId, conversationId);
    if (ejecucion) return true;
  }

  return false;
}

/**
 * Arranca el flujo que escuche esta etiqueta.
 *
 * Se llama justo despues de ponersela al contacto. Igual que con los
 * mensajes, solo entra un flujo: el editado mas recientemente entre los que
 * la escuchan.
 */
export async function iniciarPorEtiqueta(
  supabase: Supabase,
  workspaceId: string,
  contactId: string,
  tagId: string
): Promise<boolean> {
  const { data: flujos } = await supabase
    .from("flujos")
    .select("id, updated_at, flujo_disparadores(tipo, tag_id)")
    .eq("workspace_id", workspaceId)
    .eq("activo", true)
    .order("updated_at", { ascending: false });

  for (const flujo of flujos ?? []) {
    const disparadores = (flujo.flujo_disparadores ?? []) as { tipo: string; tag_id: string | null }[];
    if (!disparadores.some((d) => d.tipo === "tag" && d.tag_id === tagId)) continue;

    // La conversacion puede no existir todavia (un contacto importado al que
    // nadie le ha escrito): el flujo la abre al mandar su primer mensaje.
    const { data: conversacion } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const ejecucion = await iniciarFlujo(
      supabase,
      flujo.id as string,
      contactId,
      (conversacion?.id as string | null) ?? null
    );
    if (ejecucion) return true;
  }

  return false;
}

/**
 * Mete a un contacto al flujo a mano, desde el chat.
 *
 * Devuelve por que no se pudo, cuando no se pudo: el agente tiene que saber
 * si el contacto ya estaba en otro flujo o si el flujo esta en borrador, en
 * vez de ver que "no paso nada".
 */
export async function iniciarAMano(
  supabase: Supabase,
  flujoId: string,
  contactId: string,
  conversationId: string | null
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: flujo } = await supabase
    .from("flujos")
    .select("id, activo, flujo_disparadores(tipo)")
    .eq("id", flujoId)
    .maybeSingle();
  if (!flujo) return { ok: false, motivo: "Ese flujo ya no existe." };
  if (!flujo.activo) return { ok: false, motivo: "El flujo está en borrador: actívalo primero." };

  const disparadores = (flujo.flujo_disparadores ?? []) as { tipo: string }[];
  if (!disparadores.some((d) => d.tipo === "manual")) {
    return {
      ok: false,
      motivo: 'Este flujo no permite entrada manual. Agrégale el disparador "Un agente lo mete a mano".',
    };
  }

  if (await contactoEnFlujo(supabase, contactId)) {
    return { ok: false, motivo: "Este contacto ya está dentro de un flujo. Espera a que termine." };
  }

  if (!(await reingresoPermitido(supabase, flujoId, contactId))) {
    return { ok: false, motivo: "Este contacto ya pasó por este flujo y no puede volver a entrar." };
  }

  const ejecucion = await iniciarFlujo(supabase, flujoId, contactId, conversationId);
  if (!ejecucion) {
    return { ok: false, motivo: "No se pudo arrancar: revisa que el bloque de inicio esté conectado." };
  }
  return { ok: true };
}

/**
 * Arranca el flujo que escuche este boton.
 *
 * Se compara contra el texto del boton y contra su identificador, sin
 * distinguir mayusculas ni espacios de sobra: el usuario escribe en el
 * disparador lo que VE en el boton ("Si, Quiero Conocer"), y lo que manda
 * Meta puede venir como id o como titulo segun el tipo de boton.
 */
export async function iniciarPorBoton(
  supabase: Supabase,
  workspaceId: string,
  contactId: string,
  conversationId: string | null,
  boton: { id: string | null; titulo: string | null; whatsappAccountId?: string | null }
): Promise<boolean> {
  const candidatos = [boton.id, boton.titulo]
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean);
  if (candidatos.length === 0) return false;

  const { data: flujos } = await supabase
    .from("flujos")
    .select("id, updated_at, whatsapp_account_id, flujo_disparadores(tipo, valor)")
    .eq("workspace_id", workspaceId)
    .eq("activo", true)
    .order("updated_at", { ascending: false });

  for (const flujo of flujos ?? []) {
    const lineaDelFlujo = flujo.whatsapp_account_id as string | null;
    if (lineaDelFlujo && boton.whatsappAccountId && lineaDelFlujo !== boton.whatsappAccountId) continue;

    const disparadores = (flujo.flujo_disparadores ?? []) as { tipo: string; valor: string | null }[];
    const coincide = disparadores.some(
      (d) => d.tipo === "button_tap" && candidatos.includes((d.valor ?? "").trim().toLowerCase())
    );
    if (!coincide) continue;

    const ejecucion = await iniciarFlujo(supabase, flujo.id as string, contactId, conversationId);
    if (ejecucion) return true;
  }

  return false;
}
