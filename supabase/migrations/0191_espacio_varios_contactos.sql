-- Varios contactos por espacio (25 nov 2026).
--
-- Hasta ahora un espacio se ligaba a UN contacto del chat del administrador
-- (workspaces.cliente_contact_id, o el que coincide con el telefono de registro).
-- Ahora puede tener hasta 5: ese sigue siendo el PRINCIPAL (todo lo que ya lo
-- usa -- Leads, fidelidad, agenda, colores del chat -- no cambia) y los demas
-- van en espacio_contactos_extra. El chat de cualquiera de ellos muestra el
-- espacio, y "Registrar pago" lo encuentra.

create table if not exists public.espacio_contactos_extra (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (workspace_id, contact_id)
);
create index if not exists espacio_contactos_extra_contacto on public.espacio_contactos_extra (contact_id);

alter table public.espacio_contactos_extra enable row level security;
drop policy if exists espacio_contactos_extra_admin on public.espacio_contactos_extra;
create policy espacio_contactos_extra_admin on public.espacio_contactos_extra
  for all using (is_platform_admin()) with check (is_platform_admin());
grant select, insert, update, delete on public.espacio_contactos_extra to authenticated, service_role;

-- Tope: el principal + 4 adicionales.
create or replace function public.espacio_contactos_extra_tope()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from espacio_contactos_extra where workspace_id = new.workspace_id) >= 4 then
    raise exception 'Un espacio puede tener máximo 5 contactos vinculados (el principal y 4 más).';
  end if;
  return new;
end;
$$;
drop trigger if exists espacio_contactos_extra_tope on public.espacio_contactos_extra;
create trigger espacio_contactos_extra_tope before insert on public.espacio_contactos_extra
  for each row execute function public.espacio_contactos_extra_tope();

-- Ficha del espacio: el principal (vinculado a mano o por telefono) y los
-- adicionales, hasta 5. Cambia la salida (columna principal): se recrea.
drop function if exists public.admin_cliente_de_espacio(uuid);
create function public.admin_cliente_de_espacio(p_workspace_id uuid)
returns table(contact_id uuid, contact_name text, wa_id text, conversation_id uuid, origen text, principal boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manual uuid;
  v_phone text;
begin
  if not is_platform_admin() then
    return;
  end if;

  select cliente_contact_id, admin_telefono_normalizado(phone)
    into v_manual, v_phone
  from workspaces where id = p_workspace_id;

  return query
  with principal as (
    select c.id, c.name, c.wa_id, case when c.id = v_manual then 'manual' else 'telefono' end as origen
    from contacts c
    where c.workspace_id in (select m.workspace_id from workspace_members m where m.user_id = auth.uid())
      and (c.id = v_manual or (v_manual is null and v_phone is not null and c.wa_id = v_phone))
    order by (c.id = v_manual) desc
    limit 1
  ),
  todos as (
    select p.id, p.name, p.wa_id, p.origen, true as es_principal, null::timestamptz as desde from principal p
    union all
    select c.id, c.name, c.wa_id, 'adicional', false, x.created_at
    from espacio_contactos_extra x join contacts c on c.id = x.contact_id
    where x.workspace_id = p_workspace_id
      and not exists (select 1 from principal p where p.id = c.id)
  )
  select t.id, t.name, t.wa_id,
    (select cv.id from conversations cv where cv.contact_id = t.id order by cv.last_message_at desc nulls last limit 1),
    t.origen, t.es_principal
  from todos t
  order by t.es_principal desc, t.desde nulls first
  limit 5;
end;
$$;
revoke all on function public.admin_cliente_de_espacio(uuid) from public, anon;
grant execute on function public.admin_cliente_de_espacio(uuid) to authenticated, service_role;

-- Chat del administrador o del vendedor: el espacio de este contacto, tambien
-- si es un contacto adicional ('adicional').
create or replace function public.admin_espacio_de_contacto(p_contact_id uuid)
returns table(workspace_id uuid, workspace_name text, status text, plan_name text, vence timestamptz, apis_conectadas bigint, origen text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wa_id text;
begin
  if not (is_platform_admin() or es_vendedor_del_contacto(p_contact_id)) then
    return;
  end if;

  select c.wa_id into v_wa_id
  from contacts c
  where c.id = p_contact_id
    and c.workspace_id in (select m.workspace_id from workspace_members m where m.user_id = auth.uid());
  if v_wa_id is null then
    return;
  end if;

  return query
  select w.id, w.name, w.status, p.name,
    coalesce(
      (select s.current_period_end from subscriptions s
        where s.workspace_id = w.id and s.status = 'active'
        order by s.current_period_end desc limit 1),
      w.trial_ends_at),
    (select count(*) from whatsapp_accounts a where a.workspace_id = w.id and a.status <> 'frozen'),
    case when w.cliente_contact_id = p_contact_id then 'manual'
         when exists (select 1 from espacio_contactos_extra x where x.workspace_id = w.id and x.contact_id = p_contact_id) then 'adicional'
         else 'telefono' end
  from workspaces w
  left join plans p on p.id = w.plan_id
  where w.cliente_contact_id = p_contact_id
     or exists (select 1 from espacio_contactos_extra x where x.workspace_id = w.id and x.contact_id = p_contact_id)
     or (w.cliente_contact_id is null and admin_telefono_normalizado(w.phone) = v_wa_id)
  order by (w.cliente_contact_id = p_contact_id) desc, w.created_at desc;
end;
$$;

-- Lo que la IA sabe de la cuenta del cliente: tambien desde un contacto adicional.
create or replace function public.espacios_del_contacto(p_contact_id uuid)
returns table(workspace_name text, status text, plan_name text, vence timestamptz, lineas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.name, w.status, p.name,
    coalesce(
      (select s.current_period_end from subscriptions s
        where s.workspace_id = w.id and s.status = 'active'
        order by s.current_period_end desc limit 1),
      w.trial_ends_at),
    (select count(*) from whatsapp_accounts a where a.workspace_id = w.id and a.status <> 'frozen')
  from contacts c
  join workspaces w
    on w.cliente_contact_id = c.id
    or exists (select 1 from espacio_contactos_extra x where x.workspace_id = w.id and x.contact_id = c.id)
    or (w.cliente_contact_id is null and admin_telefono_normalizado(w.phone) = c.wa_id)
  left join plans p on p.id = w.plan_id
  where c.id = p_contact_id
  order by (w.cliente_contact_id = c.id) desc, w.created_at desc
  limit 5;
$$;

-- Color del ciclo del plan en el chat: tambien para los contactos adicionales.
create or replace function public.admin_ciclos_de_clientes()
returns table(wa_id text, status text, vence timestamptz, ultimo_pago timestamptz, es_demo boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    return;
  end if;

  return query
  select c.wa_id, w.status,
    (select max(s.current_period_end) from subscriptions s where s.workspace_id = w.id),
    (select max(coalesce(p.reviewed_at, p.created_at))
       from payments p
      where p.workspace_id = w.id and p.status = 'approved'),
    coalesce((select pl.is_demo from plans pl where pl.id = w.plan_id), false)
  from workspaces w
  join contacts c
    on c.workspace_id in (select m.workspace_id from workspace_members m where m.user_id = auth.uid())
   and (c.id = w.cliente_contact_id
        or exists (select 1 from espacio_contactos_extra x where x.workspace_id = w.id and x.contact_id = c.id)
        or (w.cliente_contact_id is null and c.wa_id = admin_telefono_normalizado(w.phone)));
end;
$$;
