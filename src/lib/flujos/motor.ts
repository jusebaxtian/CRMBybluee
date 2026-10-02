import type { createAdminClient } from "@/lib/supabase/admin";
import { resolveSendAccount } from "@/lib/whatsapp/account";
import { sendInteractiveButtonsMessage, sendTextMessage } from "@/lib/whatsapp/graph";
import { recordOutboundMessage } from "@/lib/messaging/record";
import { salidasDe, type DatosBloque, type TipoBloque } from "@/lib/flujos/bloques";
import { executeAction, type AutomationAction } from "@/lib/automations/engine";

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
    .select("id, flujo_id, workspace_id, contact_id, conversation_id, nodo_id, estado, pasos, vence_el")
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
      await cerrar(supabase, ejecucionId, "terminado");
      return;
    }

    if (tipo === "ia") {
      // Entregar a la IA es terminar el flujo y quitarle el freno al agente:
      // el historial del chat ya lo lee el solo.
      if (ejecucion.conversation_id) {
        await supabase
          .from("conversations")
          .update({ ai_manually_paused: false, ai_handoff_requested: false })
          .eq("id", ejecucion.conversation_id as string);
      }
      await cerrar(supabase, ejecucionId, "entregado");
      return;
    }

    if (tipo === "mensaje" || tipo === "inicio") {
      if (tipo === "mensaje" && datos.texto?.trim()) {
        const enviado = await sendTextMessage(
          cuenta.phone_number_id,
          cuenta.access_token,
          contacto.wa_id as string,
          datos.texto.trim()
        );
        if (ejecucion.conversation_id) {
          await recordOutboundMessage(supabase, {
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
          conversationId: ejecucion.conversation_id as string,
          messageType: "text",
          body: datos.texto.trim(),
          waMessageId: enviado.messages[0]?.id,
          buttons: botones.map((b) => ({ type: "QUICK_REPLY", text: b.title })),
        });
      }

      // Queda esperando la pulsacion. Sin tiempo limite: el vencimiento de la
      // ejecucion es el que evita que se quede ahi para siempre.
      await supabase
        .from("flujo_ejecuciones")
        .update({ estado: "esperando", nodo_id: nodoActual.id, pasos, actualizado_el: new Date().toISOString() })
        .eq("id", ejecucionId);
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

      await ejecutarComoAccion(
        supabase,
        ejecucion.workspace_id as string,
        ejecucion.contact_id as string,
        accion
      );

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

/** Mueve la ejecucion a un bloque y la corre. */
async function irANodo(supabase: Supabase, ejecucionId: string, nodoId: string) {
  await supabase
    .from("flujo_ejecuciones")
    .update({ estado: "corriendo", nodo_id: nodoId, actualizado_el: new Date().toISOString() })
    .eq("id", ejecucionId);
  await avanzar(supabase, ejecucionId);
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
  entrada: { botonId: string | null; texto: string | null }
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
    const destino = destinoDe(conexiones, nodo.id, salida);
    if (!destino) {
      await cerrar(supabase, ejecucion.id as string, "terminado");
      return true;
    }
    await irANodo(supabase, ejecucion.id as string, destino);
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
      .select("id, flujo_id, estado")
      .eq("id", espera.ejecucion_id as string)
      .maybeSingle();
    if (!ejecucion || !["corriendo", "esperando"].includes(ejecucion.estado as string)) continue;

    const { conexiones } = await grafoDelFlujo(supabase, ejecucion.flujo_id as string);
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
