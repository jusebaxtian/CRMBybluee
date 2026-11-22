-- Admin → Plan de fidelidad: semaforo de uso por cliente (22 nov 2026).
-- Por espacio: mensajes enviados (salientes) en los ultimos 7 dias y la fecha
-- del ultimo envio de toda la historia. Solo la llama el servidor con la llave
-- de servicio; nadie mas puede ejecutarla.
create or replace function public.admin_uso_de_espacios()
returns table (workspace_id uuid, enviados_7d bigint, ultimo_envio timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.workspace_id,
         count(*) filter (where m.created_at > now() - interval '7 days') as enviados_7d,
         max(m.created_at) as ultimo_envio
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.direction = 'out'
  group by c.workspace_id;
$$;

revoke all on function public.admin_uso_de_espacios() from public, anon, authenticated;
grant execute on function public.admin_uso_de_espacios() to service_role;
