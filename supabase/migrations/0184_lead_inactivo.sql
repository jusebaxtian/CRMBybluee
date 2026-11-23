-- Leads (23 nov 2026):
--  1. Etapa "Inactivo": cliente que pago pero no renovo. Pasa sola de "Pagó" a
--     "Inactivo" cuando ninguno de sus espacios tiene el plan vigente, y vuelve
--     a "Pagó" con el siguiente pago aprobado (manual o en linea).
--  2. Campanas: un contacto en "No interesado" queda fuera tambien al momento
--     de enviar (antes solo se revisaba al crear la campana).

-- 1. Etapa nueva y su fecha.
alter table public.lead_etapas drop constraint if exists lead_etapas_etapa_check;
alter table public.lead_etapas
  add constraint lead_etapas_etapa_check
  check (etapa = any (array['frio', 'tibio', 'caliente', 'pago', 'inactivo', 'no_interesado']));
alter table public.lead_etapas add column if not exists inactivo_el timestamptz;

-- Inactivo va al nivel de "caliente": los mensajes no lo mueven (ni a tibio ni a
-- caliente); solo un pago lo devuelve a "Pagó".
create or replace function public.lead_orden(p_etapa text)
returns integer
language sql
immutable
as $$
  select case p_etapa
    when 'no_interesado' then -1 when 'frio' then 0 when 'tibio' then 1
    when 'caliente' then 2 when 'inactivo' then 2 when 'pago' then 3 end;
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

  -- Un cliente (activo o inactivo) solo se marca "No interesado" a mano.
  if p_etapa = 'no_interesado' then
    update lead_etapas set etapa = 'no_interesado', no_interesado_el = p_cuando, actualizado_el = now()
    where contact_id = p_contact and etapa not in ('pago', 'inactivo', 'no_interesado');
    return;
  end if;

  update lead_etapas set
    etapa = p_etapa,
    tibio_el = case when p_etapa = 'tibio' then coalesce(tibio_el, p_cuando) else tibio_el end,
    caliente_el = case when p_etapa = 'caliente' then coalesce(caliente_el, p_cuando) else caliente_el end,
    pago_el = case when p_etapa = 'pago' then coalesce(pago_el, p_cuando) else pago_el end,
    inactivo_el = case when p_etapa = 'pago' then null else inactivo_el end,
    no_interesado_el = null,
    actualizado_el = now()
  where contact_id = p_contact and lead_orden(etapa) < lead_orden(p_etapa);
end;
$$;

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
  if p_etapa = 'inactivo' then
    update lead_etapas set etapa = 'inactivo', inactivo_el = coalesce(inactivo_el, now()), no_interesado_el = null, actualizado_el = now()
    where contact_id = p_contact;
    return true;
  end if;

  update lead_etapas set
    etapa = p_etapa,
    tibio_el = case when lead_orden(p_etapa) < 1 then null when p_etapa = 'tibio' then coalesce(tibio_el, now()) else tibio_el end,
    caliente_el = case when lead_orden(p_etapa) < 2 then null when p_etapa = 'caliente' then coalesce(caliente_el, now()) else caliente_el end,
    pago_el = case when lead_orden(p_etapa) < 3 then null else coalesce(pago_el, now()) end,
    inactivo_el = null,
    no_interesado_el = null,
    actualizado_el = now()
  where contact_id = p_contact;
  return true;
end;
$$;

-- Pasa a "Inactivo" a quien esta en "Pagó" y ya no tiene ningun espacio con el
-- plan vigente. Vigente = no esta vencido/cancelado/suspendido y su fecha de fin
-- (suscripcion o prueba) no ha pasado. La fecha de "Inactivo" es cuando vencio.
-- Quien no tiene espacio vinculado no se toca: no se sabe si renovo.
create or replace function public.lead_marcar_inactivos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  with espacios as (
    select w.cliente_contact_id as contact_id,
      bool_or(
        w.status not in ('past_due', 'canceled', 'suspended')
        and coalesce((select max(s.current_period_end) from subscriptions s where s.workspace_id = w.id), w.trial_ends_at) >= now()
      ) as vigente,
      max(coalesce((select max(s.current_period_end) from subscriptions s where s.workspace_id = w.id), w.trial_ends_at)) as vencio
    from workspaces w
    where w.cliente_contact_id is not null
    group by w.cliente_contact_id
  )
  update lead_etapas l set
    etapa = 'inactivo',
    inactivo_el = least(coalesce(e.vencio, now()), now()),
    actualizado_el = now()
  from espacios e, workspaces a
  where l.contact_id = e.contact_id
    and a.id = l.workspace_id and a.usa_etapas
    and l.etapa = 'pago'
    and not e.vigente;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.lead_marcar_inactivos() from public, anon, authenticated;
grant execute on function public.lead_marcar_inactivos() to service_role;

-- Filtro por fecha de etapa en Admin > Leads.
create or replace function public.leads_filtrados(p_workspace uuid, p_q text, p_asignado text, p_linea uuid, p_fecha_de text, p_desde timestamptz, p_hasta timestamptz)
returns setof lead_etapas
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
    and (p_desde is null or (case p_fecha_de when 'tibio' then l.tibio_el when 'caliente' then l.caliente_el when 'pago' then l.pago_el when 'inactivo' then l.inactivo_el when 'no_interesado' then l.no_interesado_el else l.frio_el end) >= p_desde)
    and (p_hasta is null or (case p_fecha_de when 'tibio' then l.tibio_el when 'caliente' then l.caliente_el when 'pago' then l.pago_el when 'inactivo' then l.inactivo_el when 'no_interesado' then l.no_interesado_el else l.frio_el end) <= p_hasta);
$$;

-- leads_pagina devuelve tambien la fecha de "Inactivo" (cambia el tipo de salida).
drop function if exists public.leads_pagina(uuid, text, text, text, uuid, text, timestamptz, timestamptz, integer, integer);
create function public.leads_pagina(p_workspace uuid, p_q text default null, p_etapa text default null, p_asignado text default null, p_linea uuid default null, p_fecha_de text default 'frio', p_desde timestamptz default null, p_hasta timestamptz default null, p_limit integer default 50, p_offset integer default 0)
returns table(contact_id uuid, nombre text, wa_id text, etapa text, frio_el timestamptz, tibio_el timestamptz, caliente_el timestamptz, pago_el timestamptz, inactivo_el timestamptz, no_interesado_el timestamptz, asignados uuid[], conversation_id uuid, total bigint)
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
  select p.contact_id, c.name, c.wa_id, p.etapa, p.frio_el, p.tibio_el, p.caliente_el, p.pago_el, p.inactivo_el, p.no_interesado_el,
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

-- 2. Al enviar una campana tambien quedan fuera los "No interesado", salvo que
-- la campana se haya hecho a proposito para esa etapa.
create or replace function public.campaign_no_followup_recipient_ids__interno(p_campaign_id uuid)
returns table(contact_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct cr.contact_id
  from campaign_recipients cr
  join contact_tags ct on ct.contact_id = cr.contact_id
  join tags t on t.id = ct.tag_id
  where cr.campaign_id = p_campaign_id and t.excludes_followups = true
  union
  select cr.contact_id
  from campaign_recipients cr
  join campaigns k on k.id = cr.campaign_id
  join lead_etapas l on l.contact_id = cr.contact_id and l.etapa = 'no_interesado'
  where cr.campaign_id = p_campaign_id
    and not ('no_interesado' = any(coalesce(k.audience_etapas, '{}')));
$$;

-- Carga inicial: quienes hoy ya cumplen la regla pasan a "Inactivo".
select public.lead_marcar_inactivos();
