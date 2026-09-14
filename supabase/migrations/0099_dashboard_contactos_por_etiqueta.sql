-- Tablero de etiquetas del dashboard: por cada etiqueta, sus contactos con el
-- ultimo mensaje de la conversacion, los mas recientes primero, paginados
-- (5 al abrir, "Ver mas" trae el resto por tandas).
--
-- Mismo patron que las funciones 0093: SECURITY DEFINER con guarda de
-- membresia, porque con SECURITY INVOKER las politicas RLS se evaluan fila
-- por fila y en espacios grandes la consulta se pasa del statement_timeout.

begin;

create or replace function dashboard_contactos_por_etiqueta(
  p_workspace_id uuid,
  p_tag_id uuid,
  p_limit int default 5,
  p_offset int default 0,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null
)
returns table (
  contact_id uuid,
  name text,
  wa_id text,
  conversation_id uuid,
  last_message_at timestamptz,
  last_body text,
  last_message_type text,
  last_direction text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_workspace_member(p_workspace_id) then
    return;
  end if;

  return query
  select
    c.id,
    c.name,
    c.wa_id,
    cv.id,
    cv.last_message_at,
    left(lm.body, 160),
    lm.message_type,
    lm.direction
  from contact_tags ct
  join tags t on t.id = ct.tag_id and t.workspace_id = p_workspace_id
  join contacts c on c.id = ct.contact_id
  left join conversations cv on cv.contact_id = c.id and cv.workspace_id = p_workspace_id
  left join lateral (
    select body, message_type, direction
    from messages m where m.conversation_id = cv.id
    order by created_at desc limit 1
  ) lm on true
  where ct.tag_id = p_tag_id
    and (p_created_from is null or c.created_at >= p_created_from)
    and (p_created_to is null or c.created_at <= p_created_to)
  order by cv.last_message_at desc nulls last, c.created_at desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
end;
$$;

revoke all on function dashboard_contactos_por_etiqueta(uuid, uuid, int, int, timestamptz, timestamptz) from public;
grant execute on function dashboard_contactos_por_etiqueta(uuid, uuid, int, int, timestamptz, timestamptz) to authenticated;

commit;
