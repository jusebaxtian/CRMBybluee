-- Resumenes de la bandeja para un conjunto concreto de conversaciones.
--
-- La version anterior, inbox_conversation_summaries(p_workspace_id), calcula
-- el resumen de TODAS las conversaciones del espacio. En el espacio mas
-- grande son 9.991 filas y 5 MB desde la base, de los que PostgREST solo
-- entrega las primeras 1.000 (PGRST_DB_MAX_ROWS=1000, respuesta 206 con
-- Content-Range 0-999/8682).
--
-- Y esas 1.000 no son las que la bandeja muestra. La funcion no lleva ORDER
-- BY, asi que devuelve las filas en el orden que salga, mientras la lista
-- pide las 1.000 mas recientes por pinned_at y last_message_at. Medido en
-- produccion: de las 1.000 visibles, solo 87 traian resumen. Las otras 913
-- se pintaban sin vista previa, sin contador de no leidos y marcadas como
-- respondidas.
--
-- Pidiendo el resumen solo de las conversaciones que se van a pintar, el
-- desajuste deja de ser posible: el conjunto es el mismo por construccion.
--
-- Se conserva p_workspace_id aunque los ids ya identifiquen la fila. La
-- funcion es SECURITY DEFINER, o sea que se salta RLS: sin ese filtro, quien
-- pudiera llamarla con ids ajenos leeria el ultimo mensaje de otro inquilino.
create or replace function inbox_conversation_summaries_for(
  p_workspace_id uuid,
  p_conversation_ids uuid[]
)
returns table (
  conversation_id uuid,
  last_body text,
  last_message_type text,
  last_direction text,
  last_created_at timestamptz,
  last_inbound_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    c.id as conversation_id,
    -- La lista pinta una sola linea recortada. Mandar el cuerpo entero
    -- significaba viajar con mensajes de miles de caracteres para mostrar
    -- cuarenta: 160 alcanzan de sobra para lo que cabe en pantalla.
    left(lm.body, 160) as last_body,
    lm.message_type as last_message_type,
    lm.direction as last_direction,
    lm.created_at as last_created_at,
    li.created_at as last_inbound_at,
    case when lm.direction = 'in' then coalesce(uc.cnt, 0) else 0 end as unread_count
  from conversations c
  left join lateral (
    select body, message_type, direction, created_at
    from messages m
    where m.conversation_id = c.id
    order by created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select created_at
    from messages m
    where m.conversation_id = c.id and m.direction = 'in'
    order by created_at desc
    limit 1
  ) li on true
  left join lateral (
    select count(*) as cnt
    from messages m
    where m.conversation_id = c.id
      and m.direction = 'in'
      and (c.last_read_at is null or m.created_at > c.last_read_at)
  ) uc on true
  where c.workspace_id = p_workspace_id
    and c.id = any(p_conversation_ids);
$$;

-- La anterior se deja en su sitio: se borra cuando ningun despliegue la use,
-- no en la misma migracion que introduce el reemplazo.

select pg_notify('pgrst', 'reload schema');
