-- Leads: la etapa del contacto (frio, tibio, caliente, pago) como dato propio y
-- no como etiqueta. Solo en los espacios marcados (decision del 5 nov 2026: Bybluee).

alter table public.workspaces
  add column if not exists usa_etapas boolean not null default false;

-- Una fila por contacto, con la fecha en que llego a cada etapa. Una fecha vacia
-- es una etapa que se salto o, en contactos viejos, una que no se pudo fechar.
create table if not exists public.lead_etapas (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  etapa text not null default 'frio' check (etapa in ('frio', 'tibio', 'caliente', 'pago')),
  frio_el timestamptz not null,
  tibio_el timestamptz,
  caliente_el timestamptz,
  pago_el timestamptz,
  actualizado_el timestamptz not null default now()
);
create index if not exists lead_etapas_espacio_idx on public.lead_etapas (workspace_id, actualizado_el desc);

alter table public.lead_etapas enable row level security;
-- Quien puede ver el contacto puede ver su etapa (hereda las reglas de contacts,
-- asi el vendedor solo ve las de sus chats). Se escribe solo por las funciones.
drop policy if exists lead_etapas_ver on public.lead_etapas;
create policy lead_etapas_ver on public.lead_etapas
  for select using (exists (select 1 from public.contacts c where c.id = contact_id));
grant select on public.lead_etapas to authenticated, service_role;

-- Las frases que mueven un contacto de etapa. 'in' = lo escribe el cliente,
-- 'out' = se lo envia el equipo o la IA.
create table if not exists public.lead_reglas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  etapa text not null check (etapa in ('tibio', 'caliente')),
  direccion text not null check (direccion in ('in', 'out')),
  frase text not null,
  unique (workspace_id, etapa, direccion, frase)
);
alter table public.lead_reglas enable row level security;
drop policy if exists lead_reglas_admin on public.lead_reglas;
create policy lead_reglas_admin on public.lead_reglas
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.lead_reglas to authenticated, service_role;

create or replace function public.lead_orden(p_etapa text)
returns integer
language sql
immutable
as $$
  select case p_etapa when 'frio' then 0 when 'tibio' then 1 when 'caliente' then 2 when 'pago' then 3 end;
$$;

-- Avanza el contacto. Nunca retrocede: para eso esta el cambio a mano.
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

  update lead_etapas set
    etapa = p_etapa,
    tibio_el = case when p_etapa = 'tibio' then coalesce(tibio_el, p_cuando) else tibio_el end,
    caliente_el = case when p_etapa = 'caliente' then coalesce(caliente_el, p_cuando) else caliente_el end,
    pago_el = case when p_etapa = 'pago' then coalesce(pago_el, p_cuando) else pago_el end,
    actualizado_el = now()
  where contact_id = p_contact and lead_orden(etapa) < lead_orden(p_etapa);
end;
$$;
revoke all on function public.lead_avanzar(uuid, uuid, text, timestamptz) from public, anon, authenticated;

-- Cambio a mano, desde el chat. Al devolverlo se borran las fechas posteriores.
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

  update lead_etapas set
    etapa = p_etapa,
    tibio_el = case when lead_orden(p_etapa) < 1 then null when p_etapa = 'tibio' then coalesce(tibio_el, now()) else tibio_el end,
    caliente_el = case when lead_orden(p_etapa) < 2 then null when p_etapa = 'caliente' then coalesce(caliente_el, now()) else caliente_el end,
    pago_el = case when lead_orden(p_etapa) < 3 then null else coalesce(pago_el, now()) end,
    actualizado_el = now()
  where contact_id = p_contact;
  return true;
end;
$$;
revoke all on function public.lead_cambiar_etapa(uuid, text) from public, anon;
grant execute on function public.lead_cambiar_etapa(uuid, text) to authenticated, service_role;

-- Disparadores. Un error aqui nunca debe impedir guardar un mensaje, un contacto
-- o un pago: se deja el aviso en el registro y se sigue.
create or replace function public.lead_contacto_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from workspaces w where w.id = new.workspace_id and w.usa_etapas) then
    insert into lead_etapas (contact_id, workspace_id, frio_el)
    values (new.id, new.workspace_id, new.created_at)
    on conflict (contact_id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'lead_contacto_nuevo: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists lead_contacto_nuevo on public.contacts;
create trigger lead_contacto_nuevo after insert on public.contacts
  for each row execute function public.lead_contacto_nuevo();

-- Las plantillas y lo que mandan las campanas o el plan de fidelidad no cuentan:
-- un envio masivo con el precio no vuelve tibios a todos sus destinatarios.
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
begin
  if new.body is null or new.body = '' or new.message_type = 'template'
     or coalesce(new.origen, '') in ('campana', 'sistema') then
    return new;
  end if;

  select c.workspace_id, c.contact_id into v_workspace, v_contact
  from conversations c join workspaces w on w.id = c.workspace_id
  where c.id = new.conversation_id and w.usa_etapas;
  if v_workspace is null then return new; end if;

  select r.etapa into v_etapa
  from lead_reglas r
  where r.workspace_id = v_workspace
    and r.direccion = new.direction
    and position(lower(r.frase) in lower(new.body)) > 0
  order by lead_orden(r.etapa) desc
  limit 1;

  if v_etapa is not null then
    perform lead_avanzar(v_contact, v_workspace, v_etapa, new.created_at);
  end if;
  return new;
exception when others then
  raise warning 'lead_mensaje_nuevo: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists lead_mensaje_nuevo on public.messages;
create trigger lead_mensaje_nuevo after insert on public.messages
  for each row execute function public.lead_mensaje_nuevo();

-- Pago aprobado de un espacio cuyo contacto esta en un espacio con etapas.
create or replace function public.lead_pago_aprobado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if new.status = 'approved' and new.workspace_id is not null then
    select c.id as contact_id, c.workspace_id into r
    from workspaces cliente
    join contacts c on c.id = cliente.cliente_contact_id
    join workspaces w on w.id = c.workspace_id and w.usa_etapas
    where cliente.id = new.workspace_id;
    if r.contact_id is not null then
      perform lead_avanzar(r.contact_id, r.workspace_id, 'pago', coalesce(new.reviewed_at, now()));
    end if;
  end if;
  return new;
exception when others then
  raise warning 'lead_pago_aprobado: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists lead_pago_aprobado on public.payments;
create trigger lead_pago_aprobado after insert or update of status on public.payments
  for each row execute function public.lead_pago_aprobado();

-- El contacto se le puede vincular al espacio despues del pago.
create or replace function public.lead_espacio_vinculado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_pago timestamptz;
begin
  select c.workspace_id into v_workspace
  from contacts c join workspaces w on w.id = c.workspace_id and w.usa_etapas
  where c.id = new.cliente_contact_id;
  if v_workspace is not null then
    select min(coalesce(p.reviewed_at, p.created_at)) into v_pago
    from payments p where p.workspace_id = new.id and p.status = 'approved';
    if v_pago is not null then
      perform lead_avanzar(new.cliente_contact_id, v_workspace, 'pago', v_pago);
    end if;
  end if;
  return new;
exception when others then
  raise warning 'lead_espacio_vinculado: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists lead_espacio_vinculado on public.workspaces;
create trigger lead_espacio_vinculado after update of cliente_contact_id on public.workspaces
  for each row when (new.cliente_contact_id is not null and new.cliente_contact_id is distinct from old.cliente_contact_id)
  execute function public.lead_espacio_vinculado();

-- Lista del modulo Leads, solo para el administrador de la plataforma.
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
      -- Solo los digitos, para encontrar "+57 300 123" aunque se guarde 57300123.
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
    and (p_desde is null or (case p_fecha_de when 'tibio' then l.tibio_el when 'caliente' then l.caliente_el when 'pago' then l.pago_el else l.frio_el end) >= p_desde)
    and (p_hasta is null or (case p_fecha_de when 'tibio' then l.tibio_el when 'caliente' then l.caliente_el when 'pago' then l.pago_el else l.frio_el end) <= p_hasta);
$$;
revoke all on function public.leads_filtrados(uuid, text, text, uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.leads_filtrados(uuid, text, text, uuid, text, timestamptz, timestamptz) to authenticated, service_role;

create or replace function public.leads_pagina(
  p_workspace uuid, p_q text default null, p_etapa text default null, p_asignado text default null, p_linea uuid default null,
  p_fecha_de text default 'frio', p_desde timestamptz default null, p_hasta timestamptz default null,
  p_limit integer default 50, p_offset integer default 0
)
returns table(
  contact_id uuid, nombre text, wa_id text, etapa text,
  frio_el timestamptz, tibio_el timestamptz, caliente_el timestamptz, pago_el timestamptz,
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
  select p.contact_id, c.name, c.wa_id, p.etapa, p.frio_el, p.tibio_el, p.caliente_el, p.pago_el,
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

create or replace function public.leads_totales(
  p_workspace uuid, p_q text default null, p_asignado text default null, p_linea uuid default null,
  p_fecha_de text default 'frio', p_desde timestamptz default null, p_hasta timestamptz default null
)
returns table(etapa text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.etapa, count(*)
  from leads_filtrados(p_workspace, p_q, p_asignado, p_linea, p_fecha_de, p_desde, p_hasta) l
  group by l.etapa;
$$;
revoke all on function public.leads_totales(uuid, text, text, uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.leads_totales(uuid, text, text, uuid, text, timestamptz, timestamptz) to authenticated, service_role;

-- Campanas por etapa.
alter table public.campaigns add column if not exists audience_etapas text[];

drop function if exists public.resolve_campaign_recipients(uuid, uuid[], uuid[], timestamptz, timestamptz);
create function public.resolve_campaign_recipients(
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
  group by c.id
  order by c.id;
$$;
revoke all on function public.resolve_campaign_recipients(uuid, uuid[], uuid[], timestamptz, timestamptz, text[]) from public, anon;
grant execute on function public.resolve_campaign_recipients(uuid, uuid[], uuid[], timestamptz, timestamptz, text[]) to authenticated, service_role;

-- Activacion en Bybluee y paso de sus contactos actuales.
update public.workspaces set usa_etapas = true where id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f';

-- Frases sacadas de los mensajes reales de Bybluee (nov 2026).
insert into public.lead_reglas (workspace_id, etapa, direccion, frase)
select '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f', e, d, f
from (values
  ('tibio', 'in', 'precio'),
  ('tibio', 'in', 'cuánto cuesta'),
  ('tibio', 'in', 'cuanto cuesta'),
  ('tibio', 'in', 'cuánto vale'),
  ('tibio', 'in', 'cuanto vale'),
  ('tibio', 'in', 'qué valor'),
  ('tibio', 'in', 'que valor'),
  ('tibio', 'out', 'plan inicial'),
  ('tibio', 'out', 'aquí están los planes'),
  ('tibio', 'out', 'tenemos dos planes'),
  ('caliente', 'out', 'puedes pagar con'),
  ('caliente', 'out', '3166230373'),
  ('caliente', 'out', '0093148895'),
  ('caliente', 'out', 'nequi'),
  ('caliente', 'out', 'daviplata')
) as v(e, d, f)
on conflict do nothing;

-- Todos arrancan frios, con la fecha real en que llegaron.
insert into public.lead_etapas (contact_id, workspace_id, frio_el, actualizado_el)
select c.id, c.workspace_id, c.created_at, c.created_at
from public.contacts c
where c.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f'
on conflict (contact_id) do nothing;

-- Tibio y caliente: la fecha del primer mensaje que cumple la regla. Es una
-- estimacion, porque las etiquetas nunca guardaron cuando se pusieron.
with primeros as (
  select v.contact_id, r.etapa, min(m.created_at) as el
  from public.messages m
  join public.conversations v on v.id = m.conversation_id
  join public.lead_reglas r
    on r.workspace_id = v.workspace_id and r.direccion = m.direction
   and position(lower(r.frase) in lower(m.body)) > 0
  where v.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f'
    and m.body is not null and m.message_type <> 'template'
    and coalesce(m.origen, '') not in ('campana', 'sistema')
  group by 1, 2
)
update public.lead_etapas l set
  tibio_el = coalesce(l.tibio_el, (select p.el from primeros p where p.contact_id = l.contact_id and p.etapa = 'tibio')),
  caliente_el = coalesce(l.caliente_el, (select p.el from primeros p where p.contact_id = l.contact_id and p.etapa = 'caliente'))
where l.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f';

-- Pagos reales, con su fecha.
update public.lead_etapas l set pago_el = p.el
from (
  select w.cliente_contact_id as contact_id, min(coalesce(a.reviewed_at, a.created_at)) as el
  from public.workspaces w join public.payments a on a.workspace_id = w.id and a.status = 'approved'
  where w.cliente_contact_id is not null
  group by 1
) p
where l.contact_id = p.contact_id and l.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f';

-- Etapa actual: la mas alta que tenga por fecha o por sus etiquetas actuales. Con
-- etiqueta y sin fecha, la columna de esa etapa queda vacia ("Sin fecha").
with etiquetas as (
  select ct.contact_id,
    bool_or(t.name in ('Plan Pro', 'Plan Anual', 'Plan Inicial', 'Plan Pro 6 Meses')) as plan,
    bool_or(t.name = 'TieneMediosPagos') as medios,
    bool_or(t.name = 'SolicitoPrecio') as precio
  from public.contact_tags ct join public.tags t on t.id = ct.tag_id
  where t.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f'
  group by 1
)
update public.lead_etapas l set
  etapa = case
    when l.pago_el is not null or coalesce(e.plan, false) then 'pago'
    when l.caliente_el is not null or coalesce(e.medios, false) then 'caliente'
    when l.tibio_el is not null or coalesce(e.precio, false) then 'tibio'
    else 'frio'
  end,
  actualizado_el = greatest(l.frio_el, coalesce(l.tibio_el, l.frio_el), coalesce(l.caliente_el, l.frio_el), coalesce(l.pago_el, l.frio_el))
from public.lead_etapas l2
left join etiquetas e on e.contact_id = l2.contact_id
where l.contact_id = l2.contact_id and l.workspace_id = '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f';

select pg_notify('pgrst', 'reload schema');
