-- Indice para las uniones laterales del resumen: cada una busca el ultimo
-- mensaje de una conversacion, o sea conversation_id + created_at desc. Con
-- solo (conversation_id) Postgres tenia que ordenar cada grupo. Medido sobre
-- el espacio de 9.991 conversaciones: 236 ms -> 134 ms.
--
-- En las bases ya vivas se creo aparte con CREATE INDEX CONCURRENTLY, que no
-- bloquea escrituras pero no puede ir dentro de una transaccion.
create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at desc);

-- Una pagina de la bandeja, ya filtrada y ordenada.
--
-- Los siete filtros corrian en el navegador sobre lo que hubiera llegado. Con
-- la bandeja paginada eso dejaba de tener sentido: buscar mostraba resultados
-- de las 40 conversaciones cargadas y no de las 9.991 que existen, y "no
-- aparece" se volvia indistinguible de "todavia no se ha traido".
--
-- Dos de los filtros --no leidos y por vencer-- dependen de datos que no
-- estan en `conversations`: hay que mirar los mensajes. Por eso el filtrado
-- vive aqui y no en la consulta de PostgREST.
--
-- Devuelve solo los identificadores y el resumen; las filas completas con
-- contacto y etiquetas las sigue trayendo la aplicacion, respetando este
-- orden.
create or replace function inbox_page(
  p_workspace_id uuid,
  p_limit int default 40,
  p_cursor_pinned_at timestamptz default null,
  p_cursor_last_message_at timestamptz default null,
  p_query text default null,
  p_channel uuid default null,
  p_tag_ids uuid[] default null,
  p_assigned text default null,
  p_unread_only boolean default false,
  p_needs_human boolean default false,
  p_expiring_soon boolean default false,
  p_now timestamptz default now()
)
returns table (
  conversation_id uuid,
  pinned_at timestamptz,
  last_message_at timestamptz,
  last_body text,
  last_message_type text,
  last_direction text,
  last_inbound_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with candidatas as (
    -- Primero lo barato: los filtros que viven en columnas, el orden y el
    -- cursor. Si no hay filtros que dependan de los mensajes, aqui ya se
    -- recorta a la pagina y las uniones laterales solo corren para esas
    -- cuarenta filas en vez de para las 9.991 del espacio. Medido: 204 ms
    -- contra 25 ms.
    --
    -- Cuando si los hay (no leidos, por vencer) no se puede recortar todavia:
    -- hay que mirar los mensajes para saber quien pasa el filtro. LIMIT NULL
    -- en Postgres significa "sin limite".
    select c.id, c.pinned_at, c.last_message_at, c.last_read_at, c.contact_id
    from conversations c
    join contacts ct on ct.id = c.contact_id
    where c.workspace_id = p_workspace_id
      and (
        p_query is null or p_query = ''
        or ct.wa_id ilike '%' || p_query || '%'
        or ct.name ilike '%' || p_query || '%'
      )
      and (p_channel is null or c.whatsapp_account_id = p_channel)
      and (p_needs_human is not true or c.ai_handoff_requested or c.ai_manually_paused)
      and (
        p_assigned is null or p_assigned = ''
        or (p_assigned = 'unassigned' and c.assigned_agent_id is null)
        or (p_assigned <> 'unassigned' and c.assigned_agent_id = p_assigned::uuid)
      )
      and (
        p_tag_ids is null or cardinality(p_tag_ids) = 0
        or exists (
          select 1 from contact_tags cg
          where cg.contact_id = ct.id and cg.tag_id = any(p_tag_ids)
        )
      )
      and (
        p_cursor_last_message_at is null
        or case
             when p_cursor_pinned_at is not null then
               (c.pinned_at = p_cursor_pinned_at and c.last_message_at < p_cursor_last_message_at)
               or c.pinned_at is null
             else c.pinned_at is null and c.last_message_at < p_cursor_last_message_at
           end
      )
    order by c.pinned_at desc nulls last, c.last_message_at desc
    limit case when p_unread_only or p_expiring_soon then null else p_limit end
  ),
  base as (
    select
      c.id,
      c.pinned_at,
      c.last_message_at,
      left(lm.body, 160) as last_body,
      lm.message_type as last_message_type,
      lm.direction as last_direction,
      li.created_at as last_inbound_at,
      case when lm.direction = 'in' then coalesce(uc.cnt, 0) else 0 end as unread_count
    from candidatas c
    left join lateral (
      select body, message_type, direction, created_at
      from messages m where m.conversation_id = c.id
      order by created_at desc limit 1
    ) lm on true
    left join lateral (
      select created_at from messages m
      where m.conversation_id = c.id and m.direction = 'in'
      order by created_at desc limit 1
    ) li on true
    left join lateral (
      select count(*) as cnt from messages m
      where m.conversation_id = c.id and m.direction = 'in'
        and (c.last_read_at is null or m.created_at > c.last_read_at)
    ) uc on true
  )
  select
    b.id, b.pinned_at, b.last_message_at, b.last_body, b.last_message_type,
    b.last_direction, b.last_inbound_at, b.unread_count
  from base b
  where (p_unread_only is not true or b.unread_count > 0)
    -- "Por vencer" es la ventana de 24 h de Meta a punto de cerrarse: entre
    -- diez segundos y dos horas de margen. Mismos numeros que
    -- lib/whatsapp/message-window.ts; si Meta cambia el plazo hay que tocar
    -- los dos lados.
    and (
      p_expiring_soon is not true
      or (
        b.last_inbound_at is not null
        and (b.last_inbound_at + interval '24 hours') - p_now between interval '10 seconds' and interval '2 hours'
      )
    )
  order by b.pinned_at desc nulls last, b.last_message_at desc
  limit p_limit;
$$;

select pg_notify('pgrst', 'reload schema');

-- Cuantos chats tienen mensajes sin leer, en todo el espacio.
--
-- La insignia del encabezado contaba sobre la lista completa que llegaba al
-- navegador. Con la bandeja paginada eso contaria sobre cuarenta y diria un
-- numero mas bajo que el real, sin avisar. Se calcula aparte para que siga
-- significando lo mismo que antes.
create or replace function inbox_unread_count(p_workspace_id uuid)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)
  from conversations c
  join lateral (
    select direction, created_at
    from messages m where m.conversation_id = c.id
    order by created_at desc limit 1
  ) lm on true
  where c.workspace_id = p_workspace_id
    and lm.direction = 'in'
    and (c.last_read_at is null or lm.created_at > c.last_read_at);
$$;

select pg_notify('pgrst', 'reload schema');
