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

/** Los siete filtros de la bandeja, tal como los ofrece la barra de la lista. */
export type InboxFilters = {
  query?: string;
  channel?: string | null;
  tagIds?: string[];
  /** "" o ausente = todos, "unassigned" = sin asignar, o el id de un agente. */
  assigned?: string | null;
  unreadOnly?: boolean;
  needsHuman?: boolean;
  expiringSoon?: boolean;
};

type PageRow = {
  conversation_id: string;
  pinned_at: string | null;
  last_message_at: string;
  last_body: string | null;
  last_message_type: string | null;
  last_direction: string | null;
  last_inbound_at: string | null;
  unread_count: number;
};

/**
 * Trae una pagina ya filtrada y ordenada.
 *
 * El filtrado ocurre en la base y no aqui: dos de los siete filtros --no
 * leidos y por vencer-- dependen de los mensajes, no de columnas de
 * `conversations`. Hacerlos en el navegador obligaba a traerse el espacio
 * entero, que es de donde venia todo el problema.
 *
 * Son dos consultas: la funcion decide QUE conversaciones y en que orden, y
 * PostgREST trae las filas completas con contacto y etiquetas. Se reordenan
 * aqui porque PostgREST no respeta el orden de la lista de ids.
 */
export async function loadInboxPage(
  supabase: SupabaseClient,
  workspaceId: string,
  opciones: { cursor?: InboxCursor | null; pageSize?: number; filters?: InboxFilters } = {}
): Promise<{ conversations: InboxConversation[]; hayMas: boolean }> {
  const tamano = opciones.pageSize ?? INBOX_PAGE_SIZE;
  const f = opciones.filters ?? {};

  const { data: pagina } = await supabase.rpc("inbox_page", {
    p_workspace_id: workspaceId,
    // Se pide una fila de mas para saber si quedan, sin contar el total.
    p_limit: tamano + 1,
    p_cursor_pinned_at: opciones.cursor?.pinnedAt ?? null,
    p_cursor_last_message_at: opciones.cursor?.lastMessageAt ?? null,
    p_query: f.query?.trim() || null,
    p_channel: f.channel || null,
    p_tag_ids: f.tagIds && f.tagIds.length > 0 ? f.tagIds : null,
    p_assigned: f.assigned || null,
    p_unread_only: !!f.unreadOnly,
    p_needs_human: !!f.needsHuman,
    p_expiring_soon: !!f.expiringSoon,
  });

  const filas = ((pagina ?? []) as PageRow[]).slice(0, tamano);
  const hayMas = ((pagina ?? []) as PageRow[]).length > tamano;
  if (filas.length === 0) return { conversations: [], hayMas: false };

  const { data: completas } = await supabase
    .from("conversations")
    .select(CAMPOS)
    .in("id", filas.map((r) => r.conversation_id));

  const porId = new Map((completas ?? []).map((c) => [c.id as string, c]));

  const conversations = filas.flatMap((r) => {
    const c = porId.get(r.conversation_id);
    if (!c) return [];
    const contacto = c.contacts as unknown as {
      name: string | null;
      wa_id: string;
      likely_blocked: boolean;
      contact_tags: { tags: { id: string; name: string; color: string } | null }[];
    };

    return [{
      id: r.conversation_id,
      last_message_at: r.last_message_at,
      pinnedAt: r.pinned_at,
      whatsappAccountId: c.whatsapp_account_id as string | null,
      lastMessagePreview:
        r.last_direction === null
          ? null
          : r.last_body ?? ETIQUETA_MEDIA[r.last_message_type ?? ""] ?? "Mensaje",
      answered: r.last_direction === null ? true : r.last_direction === "out",
      unreadCount: Number(r.unread_count ?? 0),
      assignedAgentId: c.assigned_agent_id as string | null,
      lastInboundAt: r.last_inbound_at,
      fromAds: !!c.ad_source_id,
      adHeadline: c.ad_headline as string | null,
      likelyBlocked: contacto.likely_blocked,
      needsHuman: (c.ai_handoff_requested || c.ai_manually_paused) as boolean,
      contact: { name: contacto.name, wa_id: contacto.wa_id },
      tags: contacto.contact_tags
        .map((ct) => ct.tags)
        .filter((t): t is { id: string; name: string; color: string } => t !== null),
    }];
  });

  return { conversations, hayMas };
}
