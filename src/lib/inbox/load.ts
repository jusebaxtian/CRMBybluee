import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Carga una pagina de la bandeja.
 *
 * Vive aqui y no en el layout porque la usan dos sitios: el render inicial de
 * la pagina y la accion que trae la pagina siguiente. Duplicar el mapeo
 * garantizaba que tarde o temprano las dos versiones dejaran de coincidir.
 */

/**
 * Cuantas conversaciones trae la bandeja de una vez.
 *
 * Antes no habia limite y PostgREST cortaba en 1.000 por su cuenta
 * (PGRST_DB_MAX_ROWS): el espacio de 9.991 conversaciones mostraba 1.000 y
 * nada lo indicaba.
 *
 * Cuarenta llena tres pantallas de lista. Medido contra el espacio grande:
 * 24 kB la lista mas 15 kB los resumenes, frente a los ~985 kB que viajaban
 * antes entre las dos consultas.
 */
export const INBOX_PAGE_SIZE = 40;

export type InboxConversation = {
  id: string;
  last_message_at: string;
  pinnedAt: string | null;
  whatsappAccountId: string | null;
  lastMessagePreview: string | null;
  answered: boolean;
  unreadCount: number;
  assignedAgentId: string | null;
  lastInboundAt: string | null;
  fromAds: boolean;
  adHeadline: string | null;
  likelyBlocked: boolean;
  needsHuman: boolean;
  contact: { name: string | null; wa_id: string };
  tags: { id: string; name: string; color: string }[];
};

type SummaryRow = {
  conversation_id: string;
  last_body: string | null;
  last_message_type: string | null;
  last_direction: string | null;
  last_inbound_at: string | null;
  unread_count: number;
};

const ETIQUETA_MEDIA: Record<string, string> = {
  image: "📷 Foto",
  video: "🎥 Video",
  audio: "🎤 Nota de voz",
  document: "📄 Documento",
  sticker: "🩹 Sticker",
};

const CAMPOS =
  "id, last_message_at, pinned_at, assigned_agent_id, ad_source_id, ad_headline, ai_handoff_requested, ai_manually_paused, whatsapp_account_id, contacts(name, wa_id, likely_blocked, contact_tags(tags(id, name, color)))";

/**
 * El orden de la bandeja: fijadas arriba, y dentro de cada grupo por
 * actividad reciente. `cursor` continua desde la ultima fila de la pagina
 * anterior.
 *
 * Se pagina por cursor y no por `offset` porque la lista se mueve sola: cada
 * mensaje que entra reordena las filas, y con offset una conversacion podria
 * aparecer dos veces o no aparecer, segun si subio o bajo entre dos peticiones.
 */
export type InboxCursor = { pinnedAt: string | null; lastMessageAt: string };

export async function loadInboxPage(
  supabase: SupabaseClient,
  workspaceId: string,
  opciones: { cursor?: InboxCursor | null; pageSize?: number } = {}
): Promise<{ conversations: InboxConversation[]; hayMas: boolean }> {
  const tamano = opciones.pageSize ?? INBOX_PAGE_SIZE;

  let consulta = supabase
    .from("conversations")
    .select(CAMPOS)
    .eq("workspace_id", workspaceId)
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("last_message_at", { ascending: false })
    // Se pide una fila de mas para saber si quedan, sin contar el total.
    .limit(tamano + 1);

  const cursor = opciones.cursor;
  if (cursor) {
    // Las fijadas van primero, asi que continuar significa: o seguimos entre
    // las fijadas y con fecha anterior, o ya pasamos a las no fijadas.
    consulta = cursor.pinnedAt
      ? consulta.or(
          `and(pinned_at.eq.${cursor.pinnedAt},last_message_at.lt.${cursor.lastMessageAt}),pinned_at.is.null`
        )
      : consulta.is("pinned_at", null).lt("last_message_at", cursor.lastMessageAt);
  }

  const { data: filas } = await consulta;
  const pagina = (filas ?? []).slice(0, tamano);
  const hayMas = (filas ?? []).length > tamano;

  if (pagina.length === 0) return { conversations: [], hayMas: false };

  // El resumen se pide solo de lo que se va a pintar. Pedirlo del espacio
  // entero devolvia 5 MB desde la base, de los que PostgREST entregaba 1.000
  // filas sin orden: de las 1.000 visibles, 913 se quedaban sin vista previa.
  const { data: resumenes } = await supabase.rpc("inbox_conversation_summaries_for", {
    p_workspace_id: workspaceId,
    p_conversation_ids: pagina.map((c) => c.id as string),
  });

  const porConversacion = new Map(
    ((resumenes ?? []) as SummaryRow[]).map((s) => [s.conversation_id, s])
  );

  const conversations = pagina.map((c) => {
    const resumen = porConversacion.get(c.id as string);
    const contacto = c.contacts as unknown as {
      name: string | null;
      wa_id: string;
      likely_blocked: boolean;
      contact_tags: { tags: { id: string; name: string; color: string } | null }[];
    };

    return {
      id: c.id as string,
      last_message_at: c.last_message_at as string,
      pinnedAt: (c.pinned_at as string | null) ?? null,
      whatsappAccountId: c.whatsapp_account_id as string | null,
      lastMessagePreview: resumen
        ? resumen.last_body ?? ETIQUETA_MEDIA[resumen.last_message_type ?? ""] ?? "Mensaje"
        : null,
      answered: resumen ? resumen.last_direction === "out" : true,
      unreadCount: Number(resumen?.unread_count ?? 0),
      assignedAgentId: c.assigned_agent_id as string | null,
      lastInboundAt: resumen?.last_inbound_at ?? null,
      fromAds: !!c.ad_source_id,
      adHeadline: c.ad_headline as string | null,
      likelyBlocked: contacto.likely_blocked,
      needsHuman: (c.ai_handoff_requested || c.ai_manually_paused) as boolean,
      contact: { name: contacto.name, wa_id: contacto.wa_id },
      tags: contacto.contact_tags
        .map((ct) => ct.tags)
        .filter((t): t is { id: string; name: string; color: string } => t !== null),
    };
  });

  return { conversations, hayMas };
}
