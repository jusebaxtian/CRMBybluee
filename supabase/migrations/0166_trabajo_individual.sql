-- Fijados y recordatorios independientes por persona, solo en los espacios
-- marcados (decision del 4 nov 2026: solo Bybluee y sus vendedores). Los demas
-- espacios quedan exactamente igual: fijado compartido y recordatorios como antes.

alter table public.workspaces
  add column if not exists trabajo_individual boolean not null default false;

create or replace function public.espacio_individual(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select trabajo_individual from public.workspaces where id = p_workspace_id), false);
$$;
revoke all on function public.espacio_individual(uuid) from public, anon;
grant execute on function public.espacio_individual(uuid) to authenticated, service_role;

-- 1) Fijados por persona.
create table if not exists public.conversaciones_fijadas (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fijado_el timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
create index if not exists conversaciones_fijadas_conversation_idx on public.conversaciones_fijadas (conversation_id);

alter table public.conversaciones_fijadas enable row level security;
drop policy if exists conversaciones_fijadas_propias on public.conversaciones_fijadas;
create policy conversaciones_fijadas_propias on public.conversaciones_fijadas
  for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (public.is_workspace_member(workspace_id) or public.is_platform_admin())
  );
grant select, insert, update, delete on public.conversaciones_fijadas to authenticated, service_role;

-- 2) La bandeja: en un espacio individual los fijados son los de quien consulta,
--    y solo sus miembros (o soporte) pueden cargarla. En los demas espacios no
--    cambia nada. El arreglo de seguridad para los demas espacios sigue pendiente.
create or replace function public.inbox_page(p_workspace_id uuid, p_limit integer DEFAULT 40, p_cursor_pinned_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_last_message_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_query text DEFAULT NULL::text, p_channel uuid DEFAULT NULL::uuid, p_tag_ids uuid[] DEFAULT NULL::uuid[], p_assigned text DEFAULT NULL::text, p_unread_only boolean DEFAULT false, p_needs_human boolean DEFAULT false, p_expiring_soon boolean DEFAULT false, p_now timestamp with time zone DEFAULT now(), p_unanswered_only boolean DEFAULT false)
 returns table(conversation_id uuid, pinned_at timestamp with time zone, last_message_at timestamp with time zone, last_body text, last_message_type text, last_direction text, last_inbound_at timestamp with time zone, unread_count bigint)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
    select c.id, c.pinned_at, c.last_message_at, c.last_read_at, c.contact_id
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
    select c.id, f.fijado_el, c.last_message_at, c.last_read_at, c.contact_id
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
$function$;

-- 3) Recordatorios: en un espacio individual, cada quien solo los que creo (el
--    administrador de la plataforma tampoco ve los de otros en ese espacio).
drop policy if exists recordatorios_miembros on public.recordatorios;
create policy recordatorios_miembros on public.recordatorios
  for all
  using (
    case
      when public.espacio_individual(workspace_id) then created_by = (select auth.uid())
      else
        public.is_platform_admin()
        or (
          public.is_workspace_member(workspace_id)
          and (not (select public.soy_vendedor()) or created_by = (select auth.uid()) or public.contacto_asignado_a_mi(contact_id))
        )
    end
  )
  with check (public.is_workspace_member(workspace_id) or public.is_platform_admin());

-- 4) Se activa solo en Bybluee. Sus fijados actuales no tienen autor registrado:
--    pasan al dueno, y los demas empiezan sin fijados.
update public.workspaces set trabajo_individual = true
where id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f';

insert into public.conversaciones_fijadas (user_id, conversation_id, workspace_id, fijado_el)
select m.user_id, c.id, c.workspace_id, c.pinned_at
from public.conversations c
join public.workspace_members m on m.workspace_id = c.workspace_id and m.role = 'owner'
where c.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f' and c.pinned_at is not null
on conflict do nothing;

update public.conversations set pinned_at = null
where workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f' and pinned_at is not null;

select pg_notify('pgrst', 'reload schema');
