-- Plan DEMO: una cuenta de prueba por 3, 4, 5 o 7 dias, sin precio y con limites.
--
-- 1) Tres columnas nuevas en `plans`:
--      is_demo         el plan es una cuenta de prueba (etiqueta DEMO, aviso en el
--                      perfil, plan de fidelidad de demos)
--      max_contacts    tope de contactos guardados (null = ilimitado)
--      max_bulk_sends  tope de envios masivos EN TOTAL (null = ilimitado)
--    max_agents y max_whatsapp_numbers ya existian y ya se hacen cumplir.
--
-- 2) El plan DEMO sale de "Beta-Tester". Ese plan lo usan clientes reales: antes
--    de convertirlo se COPIA a "Beta-Tester Pionero" (mismos limites, modulos y
--    precio) y todo lo que apuntaba al original se reapunta a la copia, para que
--    ninguna cuenta, pago, enlace o aviso cambie de condiciones sin darse cuenta.
--
-- 3) El tope de contactos se hace cumplir en la base, en un disparador. Todos los
--    caminos que crean contactos (a mano, por Excel, mensaje entrante de
--    WhatsApp, automatizaciones) pasan por ahi, y un tope que solo existe en una
--    pantalla se salta por la otra. Un contacto que YA existe no cuenta: un
--    upsert sobre un contacto existente es una actualizacion y no puede fallar
--    porque la cuenta este llena.
begin;

alter table public.plans
  add column if not exists is_demo boolean not null default false,
  add column if not exists max_contacts integer check (max_contacts is null or max_contacts >= 0),
  add column if not exists max_bulk_sends integer check (max_bulk_sends is null or max_bulk_sends >= 0);

comment on column public.plans.is_demo is 'Cuenta de prueba: se etiqueta DEMO, no se ofrece a la venta y no tiene precio.';
comment on column public.plans.max_contacts is 'Maximo de contactos guardados. null = ilimitado.';
comment on column public.plans.max_bulk_sends is 'Maximo de envios masivos (destinatarios de campañas) en total. null = ilimitado.';

do $$
declare
  v_old uuid;
  v_copia uuid;
begin
  select id into v_old from public.plans where name = 'Beta-Tester' and not is_demo limit 1;
  if v_old is null then
    return;
  end if;

  -- La copia conserva las condiciones de siempre para quien ya tenia el plan.
  insert into public.plans (name, price_cents, currency, billing_cycle, is_active, description,
                            max_agents, max_whatsapp_numbers, badge_label, compare_price_cents)
  select 'Beta-Tester Pionero', price_cents, currency, billing_cycle, false, description,
         max_agents, max_whatsapp_numbers, badge_label, compare_price_cents
  from public.plans where id = v_old
  returning id into v_copia;

  insert into public.plan_modules (plan_id, module_key)
  select v_copia, module_key from public.plan_modules where plan_id = v_old;

  update public.workspaces set plan_id = v_copia where plan_id = v_old;
  update public.payments set plan_id = v_copia where plan_id = v_old;
  update public.invitaciones_registro set plan_id = v_copia where plan_id = v_old;
  update public.notifications set target_plan_id = v_copia where target_plan_id = v_old;

  -- Y el plan original pasa a ser el DEMO. Se deja inactivo: no se ofrece en
  -- Facturacion ni en la web; solo se asigna con enlace demo o desde Admin.
  update public.plans
  set name = 'DEMO',
      price_cents = 0,
      compare_price_cents = null,
      billing_cycle = 'monthly',
      is_active = false,
      is_demo = true,
      max_agents = 2,
      max_whatsapp_numbers = 1,
      max_contacts = 100,
      max_bulk_sends = 100,
      badge_label = 'Cuenta DEMO',
      description = array['Hasta 100 contactos', '1 número de WhatsApp API', '2 usuarios', 'Hasta 100 envíos masivos', 'Prueba de 3 a 7 días']
  where id = v_old;
end;
$$;

create or replace function public.limite_contactos_del_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_usados integer;
begin
  select p.max_contacts into v_max
  from workspaces w join plans p on p.id = w.plan_id
  where w.id = new.workspace_id;

  -- Plan sin tope (todos menos el DEMO): no se hace nada, y es lo comun.
  if v_max is null then
    return new;
  end if;

  -- Un contacto que ya existe no ocupa lugar nuevo: el upsert lo actualiza.
  if exists (select 1 from contacts c where c.workspace_id = new.workspace_id and c.wa_id = new.wa_id) then
    return new;
  end if;

  select count(*) into v_usados from contacts c where c.workspace_id = new.workspace_id;
  if v_usados >= v_max then
    raise exception 'DEMO_LIMITE_CONTACTOS:%', v_max using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists contactos_limite_del_plan on public.contacts;
create trigger contactos_limite_del_plan
  before insert on public.contacts
  for each row execute function public.limite_contactos_del_plan();

-- La etiqueta de la bandeja del administrador tambien reconoce las cuentas DEMO.
drop function if exists public.admin_ciclos_de_clientes();
create function public.admin_ciclos_de_clientes()
returns table (
  wa_id text,
  status text,
  vence timestamptz,
  ultimo_pago timestamptz,
  es_demo boolean
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
        or (w.cliente_contact_id is null and c.wa_id = admin_telefono_normalizado(w.phone)));
end;
$$;

revoke all on function public.admin_ciclos_de_clientes() from public;
grant execute on function public.admin_ciclos_de_clientes() to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
