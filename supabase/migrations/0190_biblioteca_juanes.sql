-- Agente Juanes (25 nov 2026): biblioteca propia de imagenes, videos, audios y
-- documentos, administrada desde su pagina en Admin. Hasta ahora usaba los
-- adjuntos del agente de la linea por la que entraba el chat.
--
-- Las filas del vendedor van con del_vendedor = true y sin linea. Los agentes
-- de cada linea siguen usando las suyas (del_vendedor = false), sin cambios.

alter table public.ai_agent_media add column if not exists del_vendedor boolean not null default false;

-- La clave es unica por agente: ahora el vendedor cuenta como un agente aparte.
drop index if exists public.ai_agent_media_agente_clave;
create unique index ai_agent_media_agente_clave
  on public.ai_agent_media (workspace_id, coalesce(whatsapp_account_id, '00000000-0000-0000-0000-000000000000'::uuid), del_vendedor, key);

-- Para no dejar a Juanes sin lo que ya usa (sus instrucciones nombran qr_pago):
-- se copian a su biblioteca los adjuntos de las lineas de su espacio, una vez
-- por clave. El archivo es el mismo; borrar la copia no borra el archivo.
insert into public.ai_agent_media (workspace_id, whatsapp_account_id, del_vendedor, key, label, trigger_description, media_type, media_url, media_mime_type, filename)
select distinct on (m.key)
  m.workspace_id, null, true, m.key, m.label, m.trigger_description, m.media_type, m.media_url, m.media_mime_type, m.filename
from public.ai_agent_media m
join public.agente_vendedor v on v.workspace_id = m.workspace_id
where not m.del_vendedor
order by m.key, m.created_at
on conflict do nothing;
