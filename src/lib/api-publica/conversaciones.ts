export const COLUMNAS_CONVERSACION = "id, contact_id, status, last_message_at, whatsapp_account_id, assigned_agent_id, contacts(wa_id, name)";

type FilaConversacion = {
  id: string;
  contact_id: string;
  status: string;
  last_message_at: string | null;
  whatsapp_account_id: string | null;
  assigned_agent_id: string | null;
  contacts: { wa_id: string; name: string | null } | { wa_id: string; name: string | null }[] | null;
};

/** La conversacion tal como la ve quien usa la API. */
export function conversacionPublica(f: FilaConversacion) {
  const contacto = Array.isArray(f.contacts) ? f.contacts[0] : f.contacts;
  return {
    id: f.id,
    contacto_id: f.contact_id,
    telefono: contacto?.wa_id ?? null,
    nombre: contacto?.name ?? null,
    estado: f.status,
    linea_id: f.whatsapp_account_id,
    agente_id: f.assigned_agent_id,
    ultimo_mensaje_el: f.last_message_at,
  };
}

export const COLUMNAS_MENSAJE = "wa_message_id, id, direction, message_type, body, caption, media_url, status, error_detail, created_at";

type FilaMensaje = {
  id: string;
  wa_message_id: string | null;
  direction: string;
  message_type: string;
  body: string | null;
  caption: string | null;
  media_url: string | null;
  status: string | null;
  error_detail: string | null;
  created_at: string;
};

export function mensajePublico(f: FilaMensaje) {
  return {
    id: f.wa_message_id ?? f.id,
    direccion: f.direction === "in" ? "entrante" : "saliente",
    tipo: f.message_type === "template" ? "plantilla" : f.message_type,
    texto: f.body ?? f.caption,
    archivo_url: f.media_url,
    estado: f.status,
    error: f.error_detail,
    creado_el: f.created_at,
  };
}
