import type { createAdminClient } from "@/lib/supabase/admin";
import { agenteDeLaLinea, agenteParaBloque, maybeRespondWithAiAgent } from "@/lib/ai/agent";
import { contactoEnBloqueDeIa } from "@/lib/flujos/motor";
import { leerImagenConIa, type MimeDeImagen } from "@/lib/ai/providers";
import { avisoDeComprobante, INSTRUCCION_LECTURA, interpretarLectura, type LecturaDeImagen } from "@/lib/ai/lectura-imagen";

type Supabase = ReturnType<typeof createAdminClient>;

const MIMES: MimeDeImagen[] = ["image/jpeg", "image/png", "image/webp"];
/** Limite de Anthropic para una imagen; WhatsApp tampoco deja mandar mas de 5 MB. */
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const DIAS_VISIBLE_AVISO = 3;

/**
 * Lee la imagen con el agente de la linea, si lo tiene activado (lee_imagenes,
 * migracion 0167), y avisa si es un comprobante. Corre aunque la IA este pausada
 * en ese chat o lo tenga un flujo: muchos comprobantes llegan cuando ya atiende
 * una persona. Nunca lanza error: una imagen sin leer no debe tumbar el webhook.
 */
export async function leerImagenEntrante(
  supabase: Supabase,
  d: { workspaceId: string; conversationId: string; contactId: string; whatsappAccountId: string; waMessageId: string; mediaUrl: string; mimeType: string | null; cliente: string }
): Promise<LecturaDeImagen | null> {
  try {
    // En un bloque de IA de un flujo basta la llave: no depende del boton del
    // agente ni de la lectura de imagenes. Fuera de el, se activa agente por agente.
    const enBloque = await contactoEnBloqueDeIa(supabase, d.contactId);
    const agente = enBloque
      ? await agenteParaBloque(supabase, d.workspaceId, d.whatsappAccountId)
      : await agenteDeLaLinea(supabase, d.workspaceId, d.whatsappAccountId);
    if (!agente) return null;
    if (!enBloque && (!agente.is_active || !agente.lee_imagenes)) return null;

    const mime = (d.mimeType ?? "").split(";")[0].trim() as MimeDeImagen;
    if (!MIMES.includes(mime)) return null;

    const res = await fetch(d.mediaUrl);
    if (!res.ok) throw new Error(`no se pudo descargar la imagen (${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > TAMANO_MAXIMO) return null;

    const crudo = await leerImagenConIa(
      agente.provider,
      agente.api_key,
      agente.model,
      { base64: bytes.toString("base64"), mime },
      INSTRUCCION_LECTURA
    );
    const lectura = interpretarLectura(crudo);
    if (!lectura) {
      console.error(`lectura de imagen sin resultado util: workspace=${d.workspaceId} mensaje=${d.waMessageId}`);
      return null;
    }

    // Meta a veces entrega el mismo mensaje dos veces: solo quien logra guardar
    // la lectura sigue, y asi una foto no genera dos avisos ni dos respuestas.
    const { data: guardada } = await supabase
      .from("messages")
      .update({ lectura_imagen: lectura })
      .eq("wa_message_id", d.waMessageId)
      .is("lectura_imagen", null)
      .select("id");
    if (!guardada?.length) return null;

    if (lectura.esComprobante) await avisarComprobante(supabase, d, lectura);
    return lectura;
  } catch (err) {
    console.error(`lectura de imagen fallida: workspace=${d.workspaceId} mensaje=${d.waMessageId}:`, err);
    return null;
  }
}

/**
 * Aviso en la campana para el asesor del chat y los duenos/administradores.
 * No va a todo el espacio: un asesor no puede abrir un chat que no es suyo.
 */
async function avisarComprobante(
  supabase: Supabase,
  d: { workspaceId: string; conversationId: string; cliente: string },
  lectura: LecturaDeImagen
) {
  const [{ data: conversacion }, { data: admins }] = await Promise.all([
    supabase.from("conversations").select("assigned_agent_id").eq("id", d.conversationId).maybeSingle(),
    supabase.from("workspace_members").select("user_id").eq("workspace_id", d.workspaceId).in("role", ["owner", "admin"]),
  ]);
  const destinatarios = new Set((admins ?? []).map((a) => a.user_id as string));
  if (conversacion?.assigned_agent_id) destinatarios.add(conversacion.assigned_agent_id as string);
  if (destinatarios.size === 0) return;

  const { titulo, cuerpo } = avisoDeComprobante(lectura, d.cliente);
  const endsAt = new Date(Date.now() + DIAS_VISIBLE_AVISO * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("notifications").insert(
    [...destinatarios].map((userId) => ({
      title: titulo,
      body: cuerpo,
      scope: "workspace",
      target_workspace_id: d.workspaceId,
      target_user_id: userId,
      cta_label: "Ir al chat",
      cta_url: `/dashboard/inbox/${d.conversationId}`,
      ends_at: endsAt,
    }))
  );
  if (error) console.error("comprobante: no se pudo crear el aviso:", error.message);
}

/**
 * Responde cuando la lectura termina, sin retener el webhook: Meta reenvia el
 * mensaje si tardamos en contestarle. Si el cliente mando mas mensajes, responde
 * solo el ultimo: cinco fotos seguidas no deben generar cinco respuestas.
 */
export async function responderImagenCuandoSeLea(
  supabase: Supabase,
  lecturaEnCurso: Promise<LecturaDeImagen | null>,
  d: { workspaceId: string; conversationId: string; contactId: string; waMessageId: string }
) {
  try {
    if (!(await lecturaEnCurso)) return;
    const { data: ultimo } = await supabase
      .from("messages")
      .select("wa_message_id")
      .eq("conversation_id", d.conversationId)
      .eq("direction", "in")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultimo?.wa_message_id !== d.waMessageId) return;
    await maybeRespondWithAiAgent(supabase, d.workspaceId, d.conversationId, d.contactId);
  } catch (err) {
    console.error(`respuesta a imagen fallida: workspace=${d.workspaceId} mensaje=${d.waMessageId}:`, err);
  }
}
