-- Relación "espacio de un cliente" <-> "contacto en el chat del administrador".
--
-- El administrador vende por WhatsApp desde su propio espacio (Bybluee-CRM) y
-- necesita saber, al abrir un chat, qué espacio compró ese contacto, y al
-- revisar un espacio en Admin, con quién habló. El número que registran al
-- crear el espacio (workspaces.phone) casi siempre es el mismo desde el que
-- escriben, así que el cruce es automático por teléfono normalizado; cuando
-- no coincide, el administrador lo fija a mano (workspaces.cliente_contact_id).
--
-- Solo lo ve el administrador de la plataforma: las tres funciones son
-- SECURITY DEFINER con guarda is_platform_admin(), y "mi chat" son los
-- espacios de los que el administrador es miembro.

begin;

alter table workspaces
  add column if not exists cliente_contact_id uuid references contacts(id) on delete set null;

comment on column workspaces.cliente_contact_id is
  'Contacto (en el espacio del administrador) que compró este espacio. Vínculo manual; si es null se cruza por workspaces.phone.';

-- Solo dígitos; los celulares colombianos de 10 cifras se guardan sin el 57
-- en el registro, mientras que wa_id siempre lo trae.
create or replace function admin_telefono_normalizado(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '[^0-9]', '', 'g')) = 10 then '57' || regexp_replace(p, '[^0-9]', '', 'g')
    else nullif(regexp_replace(p, '[^0-9]', '', 'g'), '')
  end;
$$;

-- Espacio -> contacto en el chat del administrador.
create or replace function admin_cliente_de_espacio(p_workspace_id uuid)
returns table (
  contact_id uuid,
  contact_name text,
  wa_id text,
  conversation_id uuid,
  origen text
)
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
  select c.id, c.name, c.wa_id,
    (select cv.id from conversations cv where cv.contact_id = c.id order by cv.last_message_at desc nulls last limit 1),
    case when c.id = v_manual then 'manual' else 'telefono' end
  from contacts c
  where c.workspace_id in (select m.workspace_id from workspace_members m where m.user_id = auth.uid())
    and (c.id = v_manual or (v_manual is null and v_phone is not null and c.wa_id = v_phone))
  order by (c.id = v_manual) desc
  limit 1;
end;
$$;

-- Contacto en el chat del administrador -> espacio que compró.
create or replace function admin_espacio_de_contacto(p_contact_id uuid)
returns table (
  workspace_id uuid,
  workspace_name text,
  status text,
  plan_name text,
  vence timestamptz,
  apis_conectadas bigint,
  origen text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wa_id text;
begin
  if not is_platform_admin() then
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
    case when w.cliente_contact_id = p_contact_id then 'manual' else 'telefono' end
  from workspaces w
  left join plans p on p.id = w.plan_id
  where w.cliente_contact_id = p_contact_id
     or (w.cliente_contact_id is null and admin_telefono_normalizado(w.phone) = v_wa_id)
  order by (w.cliente_contact_id = p_contact_id) desc, w.created_at desc;
end;
$$;

-- Todos los espacios con su cliente, para la lista de Admin.
create or replace function admin_clientes_de_espacios()
returns table (
  workspace_id uuid,
  contact_id uuid,
  contact_name text,
  wa_id text,
  origen text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_platform_admin() then
    return;
  end if;

  return query
  select distinct on (w.id) w.id, c.id, c.name, c.wa_id,
    case when w.cliente_contact_id = c.id then 'manual' else 'telefono' end
  from workspaces w
  join contacts c
    on c.workspace_id in (select m.workspace_id from workspace_members m where m.user_id = auth.uid())
   and (c.id = w.cliente_contact_id
        or (w.cliente_contact_id is null and c.wa_id = admin_telefono_normalizado(w.phone)))
  order by w.id, (w.cliente_contact_id = c.id) desc;
end;
$$;

revoke all on function admin_cliente_de_espacio(uuid) from public;
revoke all on function admin_espacio_de_contacto(uuid) from public;
revoke all on function admin_clientes_de_espacios() from public;
grant execute on function admin_cliente_de_espacio(uuid) to authenticated;
grant execute on function admin_espacio_de_contacto(uuid) to authenticated;
grant execute on function admin_clientes_de_espacios() to authenticated;

commit;
