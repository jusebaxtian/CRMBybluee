-- Una sola definicion de "chats sin leer" para toda la aplicacion.
--
-- Hasta ahora el numero de la insignia del icono y el "(N)" de los avisos del
-- celular salian de la bandeja de avisos del sistema operativo (cada aviso
-- viejo que nadie cerro sumaba uno), no de los chats realmente sin leer. De ahi
-- que el icono dijera 100 con la bandeja vacia.
--
-- Un chat esta sin leer cuando su ULTIMO mensaje es del cliente y llego despues
-- de la ultima vez que se abrio el chat (la misma regla de inbox_unread_count y
-- de la bandeja). Un agente solo ve los chats que tiene asignados, asi que solo
-- cuenta esos; el dueño, los administradores y el modo soporte cuentan todos.

create or replace function public.chats_sin_leer(p_workspace uuid, p_user uuid)
returns table (conversation_id uuid, sin_leer bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  -- Quien llama con sesion solo puede preguntar por si mismo y por un espacio suyo
  -- (o cualquiera, si es administrador de la plataforma). El servidor (sin sesion) puede todo.
  if auth.uid() is not null then
    if p_user is distinct from auth.uid() then return; end if;
    if not (public.is_workspace_member(p_workspace) or public.is_platform_admin()) then return; end if;
  end if;

  select m.role into v_rol from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_user;

  return query
  select c.id, uc.n
  from public.conversations c
  join lateral (
    select mm.direction, mm.created_at
    from public.messages mm
    where mm.conversation_id = c.id
    order by mm.created_at desc
    limit 1
  ) lm on true
  join lateral (
    select count(*) as n
    from public.messages m2
    where m2.conversation_id = c.id
      and m2.direction = 'in'
      and (c.last_read_at is null or m2.created_at > c.last_read_at)
  ) uc on true
  where c.workspace_id = p_workspace
    -- last_message_direction lo mantiene un disparador: descarta de entrada los chats
    -- cuyo ultimo mensaje es nuestro sin mirar sus mensajes. Los null (datos viejos) se revisan.
    and c.last_message_direction is distinct from 'out'
    and lm.direction = 'in'
    and (c.last_read_at is null or lm.created_at > c.last_read_at)
    and (v_rol is distinct from 'agent' or c.assigned_agent_id = p_user)
  order by lm.created_at desc;
end;
$$;

create or replace function public.chats_sin_leer_total(p_workspace uuid, p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.chats_sin_leer(p_workspace, p_user);
$$;

revoke all on function public.chats_sin_leer(uuid, uuid) from public, anon;
revoke all on function public.chats_sin_leer_total(uuid, uuid) from public, anon;
grant execute on function public.chats_sin_leer(uuid, uuid) to authenticated, service_role;
grant execute on function public.chats_sin_leer_total(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
