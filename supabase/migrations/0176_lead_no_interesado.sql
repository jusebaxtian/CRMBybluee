-- Leads: etapa "No interesado" (decision del 9 nov 2026). Queda fuera del embudo:
-- - Se marca a mano desde el chat o sola cuando el cliente escribe una frase de
--   rechazo ("no me interesa"). Un cliente que ya pago no se marca solo.
-- - Vuelve al embudo solo si el cliente muestra interes (sus frases de tibio o
--   caliente) o paga. Lo que escribe el equipo no lo reactiva.
-- - Mientras este ahi: sin IA, sin seguimientos ni automatizaciones (como la
--   etiqueta "NO interesados") y fuera de las campanas, salvo que se elija a proposito.

alter table public.lead_etapas drop constraint if exists lead_etapas_etapa_check;
alter table public.lead_etapas add constraint lead_etapas_etapa_check
  check (etapa in ('frio', 'tibio', 'caliente', 'pago', 'no_interesado'));
-- Desde cuando no esta interesado. Se borra al volver al embudo; las fechas de
-- las otras etapas se conservan como historia.
alter table public.lead_etapas add column if not exists no_interesado_el timestamptz;

alter table public.lead_reglas drop constraint if exists lead_reglas_etapa_check;
alter table public.lead_reglas add constraint lead_reglas_etapa_check
  check (etapa in ('tibio', 'caliente', 'no_interesado'));

-- -1: cualquier etapa del embudo esta "por encima", asi que avanzar lo reactiva.
create or replace function public.lead_orden(p_etapa text)
returns integer
language sql
immutable
as $$
  select case p_etapa when 'no_interesado' then -1 when 'frio' then 0 when 'tibio' then 1 when 'caliente' then 2 when 'pago' then 3 end;
$$;

-- Una frase de rechazo cuenta como palabras completas ("bueno me interesaria" no
-- es "no me interesa") y solo en mensajes cortos: en uno largo suele venir con un
-- "pero..." ("no me interesa lo masivo, solo que conteste"). Medido con los
-- mensajes reales de Bybluee: con 100 caracteres, 14 aciertos y 0 errores.
create or replace function public.lead_frase_de_rechazo(p_frase text, p_texto text)
returns boolean
language sql
immutable
as $$
  select length(p_texto) <= 100
    and lower(p_texto) ~ ('\m' || regexp_replace(lower(p_frase), '([.*+?^$(){}|\[\]\\])', '\\\1', 'g') || '\M');
$$;

create or replace function public.lead_avanzar(p_contact uuid, p_workspace uuid, p_etapa text, p_cuando timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into lead_etapas (contact_id, workspace_id, frio_el)
  select c.id, p_workspace, c.created_at from contacts c where c.id = p_contact
  on conflict (contact_id) do nothing;

  if p_etapa = 'no_interesado' then
    update lead_etapas set etapa = 'no_interesado', no_interesado_el = p_cuando, actualizado_el = now()
    where contact_id = p_contact and etapa not in ('pago', 'no_interesado');
    return;
  end if;

  update lead_etapas set
    etapa = p_etapa,
    tibio_el = case when p_etapa = 'tibio' then coalesce(tibio_el, p_cuando) else tibio_el end,
    caliente_el = case when p_etapa = 'caliente' then coalesce(caliente_el, p_cuando) else caliente_el end,
    pago_el = case when p_etapa = 'pago' then coalesce(pago_el, p_cuando) else pago_el end,
    no_interesado_el = null,
    actualizado_el = now()
  where contact_id = p_contact and lead_orden(etapa) < lead_orden(p_etapa);
end;
$$;
revoke all on function public.lead_avanzar(uuid, uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.lead_cambiar_etapa(p_contact uuid, p_etapa text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
begin
  if lead_orden(p_etapa) is null then return false; end if;
  select l.workspace_id into v_workspace from lead_etapas l where l.contact_id = p_contact;
  if v_workspace is null then return false; end if;
  if not (
    is_platform_admin()
    or (is_workspace_member(v_workspace) and (not soy_vendedor() or contacto_asignado_a_mi(p_contact)))
  ) then
    return false;
  end if;

  -- Marcarlo no borra hasta donde llego: se ve en Leads de donde salio.
  if p_etapa = 'no_interesado' then
    update lead_etapas set etapa = 'no_interesado', no_interesado_el = coalesce(no_interesado_el, now()), actualizado_el = now()
    where contact_id = p_contact;
    return true;
  end if;

  update lead_etapas set
    etapa = p_etapa,
    tibio_el = case when lead_orden(p_etapa) < 1 then null when p_etapa = 'tibio' then coalesce(tibio_el, now()) else tibio_el end,
    caliente_el = case when lead_orden(p_etapa) < 2 then null when p_etapa = 'caliente' then coalesce(caliente_el, now()) else caliente_el end,
    pago_el = case when lead_orden(p_etapa) < 3 then null else coalesce(pago_el, now()) end,
    no_interesado_el = null,
    actualizado_el = now()
  where contact_id = p_contact;
  return true;
end;
$$;
revoke all on function public.lead_cambiar_etapa(uuid, text) from public, anon;
grant execute on function public.lead_cambiar_etapa(uuid, text) to authenticated, service_role;

create or replace function public.lead_mensaje_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_contact uuid;
  v_etapa text;
  v_actual text;
begin
  if new.body is null or new.body = '' or new.message_type = 'template'
     or coalesce(new.origen, '') in ('campana', 'sistema') then
    return new;
  end if;

  select c.workspace_id, c.contact_id into v_workspace, v_contact
  from conversations c join workspaces w on w.id = c.workspace_id
  where c.id = new.conversation_id and w.usa_etapas;
  if v_workspace is null then return new; end if;

  -- Si el mismo mensaje trae interes y rechazo, gana el interes.
  select r.etapa into v_etapa
  from lead_reglas r
  where r.workspace_id = v_workspace
    and r.direccion = new.direction
    and case when r.etapa = 'no_interesado' then lead_frase_de_rechazo(r.frase, new.body)
             else position(lower(r.frase) in lower(new.body)) > 0 end
  order by lead_orden(r.etapa) desc
  limit 1;
  if v_etapa is null then return new; end if;

  -- A quien no esta interesado solo lo reactiva lo que escribe el.
  if new.direction <> 'in' then
    select l.etapa into v_actual from lead_etapas l where l.contact_id = v_contact;
    if v_actual = 'no_interesado' then return new; end if;
  end if;

  perform lead_avanzar(v_contact, v_workspace, v_etapa, new.created_at);
  return new;
exception when others then
  raise warning 'lead_mensaje_nuevo: %', sqlerrm;
  return new;
end;
$$;

-- Lista y totales de Leads: se puede filtrar por la fecha en que se marco.
create or replace function public.leads_filtrados(
  p_workspace uuid, p_q text, p_asignado text, p_linea uuid, p_fecha_de text, p_desde timestamptz, p_hasta timestamptz
)
returns setof public.lead_etapas
language sql
stable
security definer
set search_path = public
as $$
  select l.*
  from lead_etapas l
  join contacts c on c.id = l.contact_id
  where is_platform_admin()
    and l.workspace_id = p_workspace
    and (
      p_q is null or p_q = ''
      or c.name ilike '%' || p_q || '%'
      or (p_q ~ '[0-9]' and c.wa_id ilike '%' || regexp_replace(p_q, '[^0-9]', '', 'g') || '%')
    )
    and (
      p_asignado is null or p_asignado = ''
      or (p_asignado = 'sin' and not exists (
        select 1 from conversations v where v.contact_id = c.id and v.assigned_agent_id is not null
      ))
      or (p_asignado <> 'sin' and exists (
        select 1 from conversations v where v.contact_id = c.id and v.assigned_agent_id = p_asignado::uuid
      ))
    )
    and (p_linea is null or exists (
      select 1 from conversations v where v.contact_id = c.id and v.whatsapp_account_id = p_linea
    ))
    and (p_desde is null or (case p_fecha_de when 'tibio' then l.tibio_el when 'caliente' then l.caliente_el when 'pago' then l.pago_el when 'no_interesado' then l.no_interesado_el else l.frio_el end) >= p_desde)
    and (p_hasta is null or (case p_fecha_de when 'tibio' then l.tibio_el when 'caliente' then l.caliente_el when 'pago' then l.pago_el when 'no_interesado' then l.no_interesado_el else l.frio_el end) <= p_hasta);
$$;

drop function if exists public.leads_pagina(uuid, text, text, text, uuid, text, timestamptz, timestamptz, integer, integer);
create function public.leads_pagina(
  p_workspace uuid, p_q text default null, p_etapa text default null, p_asignado text default null, p_linea uuid default null,
  p_fecha_de text default 'frio', p_desde timestamptz default null, p_hasta timestamptz default null,
  p_limit integer default 50, p_offset integer default 0
)
returns table(
  contact_id uuid, nombre text, wa_id text, etapa text,
  frio_el timestamptz, tibio_el timestamptz, caliente_el timestamptz, pago_el timestamptz, no_interesado_el timestamptz,
  asignados uuid[], conversation_id uuid, total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select * from leads_filtrados(p_workspace, p_q, p_asignado, p_linea, p_fecha_de, p_desde, p_hasta) l
    where p_etapa is null or p_etapa = '' or l.etapa = p_etapa
  ),
  pagina as (
    select f.*, count(*) over () as total from f
    order by f.actualizado_el desc, f.contact_id
    limit p_limit offset p_offset
  )
  select p.contact_id, c.name, c.wa_id, p.etapa, p.frio_el, p.tibio_el, p.caliente_el, p.pago_el, p.no_interesado_el,
    array(
      select distinct v.assigned_agent_id from conversations v
      where v.contact_id = p.contact_id and v.assigned_agent_id is not null
    ),
    (
      select v.id from conversations v
      where v.contact_id = p.contact_id and (p_linea is null or v.whatsapp_account_id = p_linea)
      order by v.last_message_at desc nulls last limit 1
    ),
    p.total
  from pagina p join contacts c on c.id = p.contact_id
  order by p.actualizado_el desc, p.contact_id;
$$;
revoke all on function public.leads_pagina(uuid, text, text, text, uuid, text, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.leads_pagina(uuid, text, text, text, uuid, text, timestamptz, timestamptz, integer, integer) to authenticated, service_role;

-- Campanas: fuera, salvo que la campana elija "No interesado" a proposito. La
-- logica vive en __interno (0172); la publica solo valida.
create or replace function public.resolve_campaign_recipients__interno(
  p_workspace_id uuid,
  p_include_tag_ids uuid[] default null,
  p_exclude_tag_ids uuid[] default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_etapas text[] default null
)
returns table(contact_id uuid, has_open_window boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as contact_id,
    coalesce(bool_or(li.created_at > now() - interval '24 hours'), false) as has_open_window
  from contacts c
  left join conversations conv on conv.contact_id = c.id and conv.workspace_id = p_workspace_id
  left join lateral (
    select created_at from messages m
    where m.conversation_id = conv.id and m.direction = 'in'
    order by created_at desc
    limit 1
  ) li on true
  where c.workspace_id = p_workspace_id
    and c.likely_blocked = false
    and (p_created_from is null or c.created_at >= p_created_from)
    and (p_created_to is null or c.created_at <= p_created_to)
    and (
      p_include_tag_ids is null or array_length(p_include_tag_ids, 1) is null
      or exists (
        select 1 from contact_tags ct
        where ct.contact_id = c.id and ct.tag_id = any(p_include_tag_ids)
      )
    )
    and not exists (
      select 1 from contact_tags ct
      join tags t on t.id = ct.tag_id
      where ct.contact_id = c.id
        and (
          (p_exclude_tag_ids is not null and ct.tag_id = any(p_exclude_tag_ids))
          or t.excludes_followups = true
        )
    )
    and (
      p_etapas is null or array_length(p_etapas, 1) is null
      or exists (select 1 from lead_etapas l where l.contact_id = c.id and l.etapa = any(p_etapas))
    )
    and (
      'no_interesado' = any(coalesce(p_etapas, '{}'))
      or not exists (select 1 from lead_etapas l where l.contact_id = c.id and l.etapa = 'no_interesado')
    )
  group by c.id
  order by c.id;
$$;
revoke all on function public.resolve_campaign_recipients__interno(uuid, uuid[], uuid[], timestamptz, timestamptz, text[]) from public, anon, authenticated;

-- Frases de Bybluee, sacadas de sus mensajes reales (nov 2026). "No gracias" y
-- "no quiero" quedan por fuera: casi siempre son otra cosa ("no quiero perder mi numero").
insert into public.lead_reglas (workspace_id, etapa, direccion, frase)
select '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f', 'no_interesado', 'in', f
from (values
  ('no me interesa'), ('no me interesan'), ('no nos interesa'),
  ('no estoy interesado'), ('no estoy interesada'),
  ('no quiero recibir'), ('no quiero que me envíen'), ('no quiero más mensajes'), ('no quiero mas mensajes'),
  ('no me sigan escribiendo'), ('no me escriban'), ('no me escribas'),
  ('dejen de escribir'), ('deja de escribirme'), ('no insistir'), ('no insistan'),
  ('no necesito su servicio'), ('no necesito el servicio')
) as v(f)
on conflict do nothing;

-- Paso de los actuales, sin tocar a quien ya pago:
-- 1) los que tienen la etiqueta "NO interesados", desde cuando se la pusieron no se
--    sabe, asi que se toma su ultimo mensaje;
-- 2) aquellos cuyo ultimo mensaje es una frase de rechazo.
with ultimo as (
  select distinct on (v.contact_id) v.contact_id, m.body, m.created_at
  from public.messages m
  join public.conversations v on v.id = m.conversation_id
  where v.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f' and m.direction = 'in'
    and m.body is not null and m.message_type <> 'template'
  order by v.contact_id, m.created_at desc
),
marcar as (
  select l.contact_id, coalesce(u.created_at, l.actualizado_el) as el
  from public.lead_etapas l
  left join ultimo u on u.contact_id = l.contact_id
  where l.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f'
    and l.etapa not in ('pago', 'no_interesado')
    and (
      exists (
        select 1 from public.contact_tags ct join public.tags t on t.id = ct.tag_id
        where ct.contact_id = l.contact_id and t.workspace_id = l.workspace_id and t.name = 'NO interesados'
      )
      or exists (
        select 1 from public.lead_reglas r
        where r.workspace_id = l.workspace_id and r.etapa = 'no_interesado' and r.direccion = 'in'
          and public.lead_frase_de_rechazo(r.frase, u.body)
      )
    )
)
update public.lead_etapas l set etapa = 'no_interesado', no_interesado_el = m.el, actualizado_el = now()
from marcar m where l.contact_id = m.contact_id;

select pg_notify('pgrst', 'reload schema');
