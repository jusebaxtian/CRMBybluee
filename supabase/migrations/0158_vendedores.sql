-- Vendedores: personas que venden el CRM desde el espacio de Bybluee y ganan
-- una comision por la PRIMERA venta de cada cliente.
--
-- Un vendedor es un asesor (rol 'agent') del espacio del administrador con una
-- fila aqui. Como asesor ya ve solo los chats que le asignan; ademas puede
-- registrar la venta con el comprobante del chat (solo en sus chats). Cada
-- venta queda en ventas_vendedor con el porcentaje vigente en ese momento, y
-- el administrador la aprueba (el dinero entro), la marca pagada o la anula.

create table if not exists public.vendedores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Espacio donde atiende (el del administrador): sus chats salen de ahi.
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  comision_pct numeric(5, 2) not null default 20 check (comision_pct >= 0 and comision_pct <= 100),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table if not exists public.ventas_vendedor (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  -- Cliente nuevo: nace de un enlace de registro; al registrarse queda el espacio.
  invitacion_id uuid references public.invitaciones_registro (id) on delete set null,
  -- Cliente que ya tenia espacio: el pago se aplica de una vez.
  cliente_workspace_id uuid references public.workspaces (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  plan_id uuid references public.plans (id) on delete set null,
  monto_cents bigint not null check (monto_cents > 0),
  comision_pct numeric(5, 2) not null,
  comision_cents bigint not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'pagada', 'anulada')),
  created_at timestamptz not null default now(),
  aprobada_at timestamptz,
  aprobada_por uuid references auth.users (id) on delete set null,
  pagada_at timestamptz,
  nota_pago text,
  anulada_at timestamptz,
  motivo_anulacion text
);

-- Solo la primera venta de cada cliente da comision: una venta vigente por contacto.
create unique index if not exists ventas_vendedor_una_por_contacto
  on public.ventas_vendedor (contact_id) where estado <> 'anulada' and contact_id is not null;
create index if not exists ventas_vendedor_por_vendedor on public.ventas_vendedor (vendedor_id, created_at desc);

-- El chat de un cliente vendido queda a nombre del vendedor: no se reasigna salvo
-- el dueño o un administrador del espacio.
alter table public.conversations
  add column if not exists vendedor_id uuid references auth.users (id) on delete set null;

alter table public.vendedores enable row level security;
alter table public.ventas_vendedor enable row level security;

create policy "vendedores_select" on public.vendedores
  for select using (user_id = auth.uid() or public.is_platform_admin());
create policy "ventas_vendedor_select" on public.ventas_vendedor
  for select using (vendedor_id = auth.uid() or public.is_platform_admin());
-- Las escrituras las hace solo el servidor (cliente de servicio).

-- ¿Este usuario puede vender a este contacto? Vendedor activo y con un chat de
-- ese contacto asignado a el.
create or replace function public.es_vendedor_del_contacto(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vendedores v
    join public.conversations c on c.workspace_id = v.workspace_id and c.contact_id = p_contact_id
    where v.user_id = auth.uid() and v.activo and c.assigned_agent_id = auth.uid()
  );
$$;

-- El vendedor tambien necesita saber si el contacto ya tiene espacio (para no
-- crear uno nuevo y saber si ya pago antes). Misma funcion del administrador,
-- abierta a quien puede venderle a ese contacto.
create or replace function public.admin_espacio_de_contacto(p_contact_id uuid)
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
    case when w.cliente_contact_id = p_contact_id then 'manual' else 'telefono' end
  from workspaces w
  left join plans p on p.id = w.plan_id
  where w.cliente_contact_id = p_contact_id
     or (w.cliente_contact_id is null and admin_telefono_normalizado(w.phone) = v_wa_id)
  order by (w.cliente_contact_id = p_contact_id) desc, w.created_at desc;
end;
$$;

revoke all on function public.es_vendedor_del_contacto(uuid) from public, anon;
grant execute on function public.es_vendedor_del_contacto(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
