-- Una conversacion por contacto POR LINEA.
--
-- Desde 0066 la regla es (workspace_id, contact_id, whatsapp_account_id),
-- pero la regla vieja (workspace_id, contact_id) de 0004 seguia viva.
-- Cuando el mismo contacto escribia a las dos lineas de un espacio, el
-- segundo hilo chocaba con la regla vieja y el mensaje se descartaba
-- ("conversation upsert failed": 73 mensajes perdidos en YANLA SHOPS y
-- otros dos espacios con dos lineas). Se elimina la regla vieja.

-- Misma sanidad que 0079: sin linea no hay forma de encajar en la regla
-- por linea, asi que se rellena con la primera linea conectada del espacio.
update public.conversations c
set whatsapp_account_id = fallback.id
from (
  select distinct on (workspace_id) workspace_id, id
  from public.whatsapp_accounts
  where status <> 'frozen'
  order by workspace_id, connected_at asc
) fallback
where c.whatsapp_account_id is null
  and c.workspace_id = fallback.workspace_id;

alter table public.conversations drop constraint if exists conversations_workspace_id_contact_id_key;

-- La consulta habitual "conversaciones de este contacto" seguia apoyada en
-- el indice de la regla vieja; este lo reemplaza.
create index if not exists conversations_workspace_contact_idx
  on public.conversations (workspace_id, contact_id);
