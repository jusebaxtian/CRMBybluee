-- Bandeja (23 nov 2026, diseno A aprobado):
--  1. Marcar un chat como no leido a mano (conversations.marcado_no_leido). Se
--     limpia al abrir el chat. Cuenta en "No leidos" y en el contador.
--  2. Hora de entregado y de leido de cada mensaje enviado (las manda Meta en
--     el aviso de estado). Los mensajes viejos no la tienen.

alter table public.conversations add column if not exists marcado_no_leido boolean not null default false;
alter table public.messages add column if not exists entregado_el timestamptz;
alter table public.messages add column if not exists leido_el timestamptz;

create or replace function public.inbox_unread_count__interno(p_workspace_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from conversations c
  left join lateral (
    select direction, created_at
    from messages m where m.conversation_id = c.id
    order by created_at desc limit 1
  ) lm on true
  where c.workspace_id = p_workspace_id
    and (
      c.marcado_no_leido
      or (lm.direction = 'in' and (c.last_read_at is null or lm.created_at > c.last_read_at))
    );
$$;

-- La lista: misma funcion de antes, con la marca manual en "No leidos".
CREATE OR REPLACE FUNCTION public.inbox_page__interno(p_workspace_id uuid, p_limit integer DEFAULT 40, p_cursor_pinned_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_last_message_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_query text DEFAULT NULL::text, p_channel uuid DEFAULT NULL::uuid, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_assigned text DEFAULT NULL::text, p_unread_only boolean DEFAULT false, p_needs_human boolean DEFAULT false, p_expiring_soon boolean DEFAULT false, p_now timestamp with time zone DEFAULT now(), p_unanswered_only boolean DEFAULT false)
 RETURNS TABLE(conversation_id uuid, pinned_at timestamp with time zone, last_message_at timestamp with time zone, last_body text, last_message_type text, last_direction text, last_inbound_at timestamp with time zone, unread_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    --
    -- Son dos ramas y no una con el fijado calculado: unirlas le quita a la base
    -- el indice de orden. Medido el 4 nov 2026 en el espacio de 12.484 chats:
    -- 39 ms contra 294 ms. Solo corre la rama que corresponde al espacio.
    (
    select c.id, c.pinned_at, c.last_message_at, c.last_read_at, c.contact_id, c.marcado_no_leido
    from conversations c
    join contacts ct on ct.id = c.contact_id
    where c.workspace_id = p_workspace_id
      and not (select public.espacio_individual(p_workspace_id))
      and (
        p_query is null or p_query = ''
        or ct.wa_id ilike '%' || p_query || '%'
        or ct.name ilike '%' || p_query || '%'
      )
      and (p_channel is null or c.whatsapp_account_id = p_channel)
      -- "Sin responder": el cliente hablo de ultimo. Lo mantiene el disparador
      -- sync_conversation_for_ai_followups; no hay que mirar los mensajes.
      and (p_unanswered_only is not true or c.last_message_direction = 'in')
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
    )
    union all
    (
    select c.id, f.fijado_el, c.last_message_at, c.last_read_at, c.contact_id, c.marcado_no_leido
    from conversations c
    join contacts ct on ct.id = c.contact_id
    left join conversaciones_fijadas f
      on f.conversation_id = c.id and f.user_id = (select auth.uid())
    where c.workspace_id = p_workspace_id
      and (select public.espacio_individual(p_workspace_id))
      and ((select is_workspace_member(p_workspace_id)) or (select is_platform_admin()))
      and (
        p_query is null or p_query = ''
        or ct.wa_id ilike '%' || p_query || '%'
        or ct.name ilike '%' || p_query || '%'
      )
      and (p_channel is null or c.whatsapp_account_id = p_channel)
      -- "Sin responder": el cliente hablo de ultimo. Lo mantiene el disparador
      -- sync_conversation_for_ai_followups; no hay que mirar los mensajes.
      and (p_unanswered_only is not true or c.last_message_direction = 'in')
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
               (f.fijado_el = p_cursor_pinned_at and c.last_message_at < p_cursor_last_message_at)
               or f.fijado_el is null
             else f.fijado_el is null and c.last_message_at < p_cursor_last_message_at
           end
      )
    order by f.fijado_el desc nulls last, c.last_message_at desc
    limit case when p_unread_only or p_expiring_soon then null else p_limit end
    )
  ),
  base as (
    select
      c.id,
      c.pinned_at,
      c.last_message_at,
      c.marcado_no_leido,
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
  where (p_unread_only is not true or b.unread_count > 0 or b.marcado_no_leido)
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
$function$
;
