-- Agentes de IA independientes por linea: los adjuntos (ai_agent_media) eran
-- del espacio entero y todos los agentes los veian. Desde aqui cada adjunto es
-- de UN agente: el de su linea (whatsapp_account_id) o el general (null). Lo
-- unico que siguen compartiendo los agentes es la API key.
--
-- Para no dejar a ningun agente sin lo que ya usaba, cada adjunto existente se
-- copia a cada agente de linea del espacio. El original queda para el agente
-- general; si el espacio no tiene agente general, se borra (ya esta copiado).
-- Las copias apuntan al mismo archivo: borrar un adjunto nunca borra el archivo.

alter table public.ai_agent_media
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete cascade;

-- La clave ya no es unica por espacio sino por agente.
alter table public.ai_agent_media drop constraint if exists ai_agent_media_workspace_id_key_key;
drop index if exists public.ai_agent_media_workspace_id_key_key;
create unique index if not exists ai_agent_media_agente_clave
  on public.ai_agent_media (workspace_id, coalesce(whatsapp_account_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

insert into public.ai_agent_media
  (workspace_id, whatsapp_account_id, key, label, trigger_description, media_type, media_url, media_mime_type, filename, created_at)
select m.workspace_id, a.whatsapp_account_id, m.key, m.label, m.trigger_description, m.media_type, m.media_url, m.media_mime_type, m.filename, m.created_at
from public.ai_agent_media m
join public.ai_agents a on a.workspace_id = m.workspace_id and a.whatsapp_account_id is not null
where m.whatsapp_account_id is null
on conflict do nothing;

delete from public.ai_agent_media m
where m.whatsapp_account_id is null
  and exists (select 1 from public.ai_agents a where a.workspace_id = m.workspace_id)
  and not exists (select 1 from public.ai_agents a where a.workspace_id = m.workspace_id and a.whatsapp_account_id is null);

select pg_notify('pgrst', 'reload schema');
