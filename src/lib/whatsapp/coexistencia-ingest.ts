import type { createAdminClient } from "@/lib/supabase/admin";
import { recordOutboundMessage } from "@/lib/messaging/record";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-types";
import {
  contenidoDeLaApp,
  dentroDeLosUltimosDias,
  direccionDelHistorial,
  estadoDelHistorial,
  soloDigitos,
  type MensajeDeLaApp,
} from "@/lib/whatsapp/coexistencia";

/**
 * Lo que llega del celular de una linea en coexistencia.
 *
 * REGLA DE ORO de este archivo: lo que entra por aqui se GUARDA y se MUESTRA,
 * pero no pone nada en marcha. Nada de automatizaciones, flujos, agente de IA,
 * notificaciones ni seguimientos: son mensajes que una persona ya escribio (o
 * que ya pasaron), y reaccionar a ellos mandaria mensajes a clientes sin que
 * nadie lo pidiera. Dos disparadores de la base de datos si miran toda fila
 * nueva de `messages` (seguimientos "sin respuesta" y ancla de seguimientos de
 * la IA); por eso cada mensaje se guarda con `exclude_from_followups` y, al
 * terminar un hilo del historial, se limpia el ancla de la IA.
 */

type Db = ReturnType<typeof createAdminClient>;
type Valor = WhatsAppWebhookPayload["entry"][number]["changes"][number]["value"];

type Ayudas = {
  resolveContact: (
    supabase: Db,
    workspaceId: string,
    waId: string,
    bsuid: string | null,
    profileName: string | undefined,
    username?: string | null
  ) => Promise<{ id: string } | null>;
  persistIncomingMedia: (
    supabase: Db,
    workspaceId: string,
    accessToken: string,
    mediaId: string
  ) => Promise<{ url: string; mimeType: string } | null>;
};

type Cuenta = { id: string; workspace_id: string; access_token: string; display_phone_number: string | null };

async function buscarCuenta(supabase: Db, phoneNumberId: string | undefined): Promise<Cuenta | null> {
  if (!phoneNumberId) return null;
  const { data } = await supabase
    .from("whatsapp_accounts")
    .select("id, workspace_id, access_token, display_phone_number, connection_mode")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  // Estos avisos solo los manda Meta para numeros en coexistencia: si la linea no esta marcada asi, se ignoran.
  if (!data || data.connection_mode !== "coexistencia") return null;
  return data as Cuenta;
}

/** Un lote de tareas a la vez: el aviso puede traer miles de elementos y Meta espera una respuesta rapida. */
async function enLotes<T>(items: T[], tamano: number, tarea: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += tamano) {
    await Promise.all(items.slice(i, i + tamano).map(tarea));
  }
}

type EstadoSync = {
  contactos?: { estado: "pendiente" | "listo" | "error"; total?: number };
  historial?: { estado: "pendiente" | "en_curso" | "listo" | "rechazado" | "error"; progreso?: number };
};

/** Mezcla un parche en `coex_sync` sin pisar la otra mitad (contactos / historial). */
export async function actualizarSync(supabase: Db, cuentaId: string, parche: EstadoSync) {
  const { data } = await supabase.from("whatsapp_accounts").select("coex_sync").eq("id", cuentaId).maybeSingle();
  const actual = (data?.coex_sync ?? {}) as EstadoSync;
  const nuevo: EstadoSync = { ...actual, ...parche };
  // El avance nunca retrocede: los bloques del historial pueden llegar desordenados.
  if (parche.historial?.progreso !== undefined && actual.historial?.progreso !== undefined) {
    nuevo.historial = { ...parche.historial, progreso: Math.max(parche.historial.progreso, actual.historial.progreso) };
  }
  await supabase.from("whatsapp_accounts").update({ coex_sync: nuevo }).eq("id", cuentaId);
}

// ---------------------------------------------------------------- mensajes enviados desde el celular

export async function ingestarEcos(supabase: Db, value: Valor, ayudas: Ayudas) {
  const cuenta = await buscarCuenta(supabase, value.metadata?.phone_number_id);
  if (!cuenta) return;

  for (const eco of value.message_echoes ?? []) {
    try {
      await ingestarUnEco(supabase, cuenta, eco, ayudas);
    } catch (err) {
      console.error("coexistencia: no se pudo guardar un mensaje enviado desde el celular", {
        cuenta: cuenta.id,
        mensaje: eco.id,
        err,
      });
    }
  }
}

async function ingestarUnEco(supabase: Db, cuenta: Cuenta, eco: MensajeDeLaApp, ayudas: Ayudas) {
  // Una edicion cambia el texto del mensaje original; no es un mensaje nuevo.
  if (eco.type === "edit") {
    const original = eco.edit?.original_message_id;
    const texto = eco.edit?.message?.text?.body;
    if (original && texto) await supabase.from("messages").update({ body: texto }).eq("wa_message_id", original);
    return;
  }
  if (eco.type === "revoke") return;

  const { data: yaGuardado } = await supabase.from("messages").select("id").eq("wa_message_id", eco.id).maybeSingle();
  if (yaGuardado) return;

  const waId = soloDigitos(eco.to);
  if (!waId) return;

  const contacto = await ayudas.resolveContact(supabase, cuenta.workspace_id, waId, null, undefined);
  if (!contacto) return;

  const cuando = new Date(Number(eco.timestamp) * 1000).toISOString();
  const { data: conversacion } = await supabase
    .from("conversations")
    .upsert(
      {
        workspace_id: cuenta.workspace_id,
        contact_id: contacto.id,
        whatsapp_account_id: cuenta.id,
        last_message_at: cuando,
        status: "open",
      },
      { onConflict: "workspace_id,contact_id,whatsapp_account_id" }
    )
    .select("id")
    .single();
  if (!conversacion) return;

  const contenido = contenidoDeLaApp(eco);
  let mediaUrl: string | null = null;
  let mediaMimeType: string | null = contenido.mimeType;
  if (contenido.mediaId) {
    const guardado = await ayudas.persistIncomingMedia(supabase, cuenta.workspace_id, cuenta.access_token, contenido.mediaId);
    mediaUrl = guardado?.url ?? null;
    mediaMimeType = guardado?.mimeType ?? contenido.mimeType;
  }

  await recordOutboundMessage(supabase, {
    conversationId: conversacion.id,
    messageType: contenido.tipo,
    waMessageId: eco.id,
    body: contenido.texto,
    mediaUrl,
    mediaMimeType,
    sentFromApp: true,
    // Es una persona atendiendo desde su celular: ni seguimientos automaticos...
    excludeFromFollowups: true,
    createdAt: cuando,
  });

  // ...ni el agente de IA hablando encima. Se reanuda a mano desde el chat.
  await supabase.from("conversations").update({ ai_manually_paused: true }).eq("id", conversacion.id);
}

// ---------------------------------------------------------------- historial (solo los ultimos 30 dias)

export async function ingestarHistorial(supabase: Db, value: Valor, ayudas: Ayudas) {
  const cuenta = await buscarCuenta(supabase, value.metadata?.phone_number_id);
  if (!cuenta) return;
  const numeroDelNegocio = value.metadata?.display_phone_number ?? cuenta.display_phone_number ?? undefined;

  for (const bloque of value.history ?? []) {
    // 2593109: la persona decidio no compartir el historial desde su app.
    if (bloque.errors?.length) {
      await actualizarSync(supabase, cuenta.id, { historial: { estado: "rechazado" } });
      continue;
    }

    await enLotes(bloque.threads ?? [], 6, async (hilo) => {
      try {
        await importarHilo(supabase, cuenta, numeroDelNegocio, hilo.id, hilo.messages ?? [], ayudas);
      } catch (err) {
        console.error("coexistencia: no se pudo importar un hilo del historial", { cuenta: cuenta.id, err });
      }
    });

    const progreso = bloque.metadata?.progress;
    if (progreso !== undefined) {
      await actualizarSync(supabase, cuenta.id, {
        historial: { estado: progreso >= 100 ? "listo" : "en_curso", progreso },
      });
    }
  }
}

async function importarHilo(
  supabase: Db,
  cuenta: Cuenta,
  numeroDelNegocio: string | undefined,
  idDelHilo: string,
  mensajes: MensajeDeLaApp[],
  ayudas: Ayudas
) {
  const ahora = Date.now();
  const waId = soloDigitos(idDelHilo);
  const recientes = mensajes.filter((m) => dentroDeLosUltimosDias(m.timestamp, ahora));
  if (!waId || recientes.length === 0) return;

  const contacto = await ayudas.resolveContact(supabase, cuenta.workspace_id, waId, null, undefined);
  if (!contacto) {
    // Lo mas comun: el plan llego a su tope de contactos. Antes fallaba en silencio.
    console.error("coexistencia: no se pudo crear el contacto de un chat del historial (¿tope de contactos del plan?)", {
      cuenta: cuenta.id,
      espacio: cuenta.workspace_id,
      mensajes: recientes.length,
    });
    return;
  }

  const ultimaMarca = Math.max(...recientes.map((m) => Number(m.timestamp)));
  const ultimoIso = new Date(ultimaMarca * 1000).toISOString();

  // La conversacion se busca primero: si ya existe (el cliente ya escribia), no se
  // le cambia el estado ni se marca nada como leido que no lo estuviera.
  let { data: conversacion } = await supabase
    .from("conversations")
    .select("id, last_message_at, last_read_at")
    .eq("workspace_id", cuenta.workspace_id)
    .eq("contact_id", contacto.id)
    .eq("whatsapp_account_id", cuenta.id)
    .maybeSingle();

  if (!conversacion) {
    const { data: creada, error } = await supabase
      .from("conversations")
      .insert({
        workspace_id: cuenta.workspace_id,
        contact_id: contacto.id,
        whatsapp_account_id: cuenta.id,
        status: "open",
        last_message_at: ultimoIso,
        // Historia ya vista: que no aparezca como "sin leer".
        last_read_at: ultimoIso,
      })
      .select("id, last_message_at, last_read_at")
      .single();
    if (error || !creada) {
      // Carrera con otro bloque que la creo primero.
      const { data: otra } = await supabase
        .from("conversations")
        .select("id, last_message_at, last_read_at")
        .eq("workspace_id", cuenta.workspace_id)
        .eq("contact_id", contacto.id)
        .eq("whatsapp_account_id", cuenta.id)
        .maybeSingle();
      conversacion = otra;
    } else {
      conversacion = creada;
    }
  }
  if (!conversacion) return;

  const ids = recientes.map((m) => m.id);
  const { data: existentes } = await supabase.from("messages").select("wa_message_id").in("wa_message_id", ids);
  const yaEstan = new Set((existentes ?? []).map((e) => e.wa_message_id as string));

  const filas = recientes
    .filter((m) => !yaEstan.has(m.id))
    .map((m) => {
      const direccion = direccionDelHistorial(m.from, numeroDelNegocio);
      const contenido = contenidoDeLaApp(m);
      return {
        conversation_id: conversacion!.id,
        direction: direccion,
        message_type: contenido.tipo === "text" || !contenido.mediaId ? "text" : contenido.tipo,
        body: contenido.texto ?? (contenido.tipo === "text" ? null : `📎 ${contenido.tipo} del historial (no disponible)`),
        wa_message_id: m.id,
        status: direccion === "out" ? estadoDelHistorial(m.history_context?.status) : "delivered",
        created_at: new Date(Number(m.timestamp) * 1000).toISOString(),
        sent_from_app: direccion === "out",
        // Sin esto el disparador de seguimientos agendaria avisos "sin respuesta" ya vencidos.
        exclude_from_followups: true,
      };
    });

  for (let i = 0; i < filas.length; i += 200) {
    await supabase.from("messages").insert(filas.slice(i, i + 200));
  }

  // Los disparadores de la base dejaron "ultima direccion" y el ancla de los
  // seguimientos de la IA segun el orden en que se insertaron las filas. Se
  // corrige con el mensaje que de verdad es el ultimo, y se quita el ancla.
  const { data: ultimo } = await supabase
    .from("messages")
    .select("direction")
    .eq("conversation_id", conversacion.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const masNuevo = (a: string | null, b: string) => (a && a > b ? a : b);
  await supabase
    .from("conversations")
    .update({
      last_message_at: masNuevo(conversacion.last_message_at, ultimoIso),
      last_read_at: masNuevo(conversacion.last_read_at, ultimoIso),
      ai_followup_started_at: null,
      ...(ultimo ? { last_message_direction: ultimo.direction } : {}),
    })
    .eq("id", conversacion.id);
}

// ---------------------------------------------------------------- contactos de la app

/**
 * Contactos de la agenda de la app: SOLO le ponen nombre a contactos que ya
 * estan en el CRM. No crean contactos nuevos.
 *
 * Antes los creaba todos, y la agenda del celular (cientos de personas que no
 * son clientes) llenaba el tope de contactos del plan: desde ahi los mensajes
 * de clientes nuevos se perdian porque no habia cupo para crearles contacto.
 * Paso el 27 oct 2026 con la primera conexion real (plan DEMO, tope de 100).
 * Los contactos de los chats SI se crean, pero desde el historial y los
 * mensajes, que son conversaciones de verdad.
 */
export async function ingestarSyncDeContactos(supabase: Db, value: Valor) {
  const cuenta = await buscarCuenta(supabase, value.metadata?.phone_number_id);
  if (!cuenta) return;

  const nombres = new Map<string, string>();
  for (const s of value.state_sync ?? []) {
    if (s.type !== "contact" || s.action === "remove") continue;
    const waId = soloDigitos(s.contact?.phone_number);
    const nombre = (s.contact?.full_name || s.contact?.first_name || "").trim();
    if (waId && nombre) nombres.set(waId, nombre);
  }

  let actualizados = 0;
  const numeros = [...nombres.keys()];
  for (let i = 0; i < numeros.length; i += 200) {
    const { data: existentes } = await supabase
      .from("contacts")
      .select("id, wa_id, name, name_source")
      .eq("workspace_id", cuenta.workspace_id)
      .in("wa_id", numeros.slice(i, i + 200));
    // Misma regla de nombres que la ingesta: el que escribio el equipo (manual o
    // por Excel) manda; solo se rellena si no hay nombre o vino de WhatsApp.
    const porActualizar = (existentes ?? []).filter((c) => !c.name || c.name_source === "whatsapp" || c.name_source === null);
    await enLotes(porActualizar, 10, async (c) => {
      const nombre = nombres.get(c.wa_id as string);
      if (!nombre || nombre === c.name) return;
      const { error } = await supabase.from("contacts").update({ name: nombre, name_source: "whatsapp" }).eq("id", c.id);
      if (!error) actualizados++;
    });
  }

  await actualizarSync(supabase, cuenta.id, { contactos: { estado: "listo", total: actualizados } });
}

// ---------------------------------------------------------------- la persona desvinculo desde el celular

export async function ingestarCuentaActualizada(supabase: Db, entryId: string, value: Valor) {
  if (value.event !== "PARTNER_REMOVED") return;
  const wabaId = value.waba_info?.waba_id ?? entryId;
  if (!wabaId) return;
  await supabase
    .from("whatsapp_accounts")
    .update({ status: "disconnected" })
    .eq("waba_id", wabaId)
    .eq("connection_mode", "coexistencia");
}
