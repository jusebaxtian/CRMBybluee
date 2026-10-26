-- Sistema de referidos: quien tiene una licencia de pago comparte su enlace y,
-- cuando la persona referida hace su PRIMER pago aprobado, gana un mes gratis.
-- Maximo 3 meses de por vida por espacio. El mes se guarda como saldo y se usa
-- cuando el cliente quiere: se suma al final del periodo vigente.

-- ---------------------------------------------------------------- codigos
create or replace function public.generar_codigo_referido()
returns text
language plpgsql
volatile
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.workspaces where referral_code = c);
  end loop;
  return c;
end;
$$;

alter table public.workspaces
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.workspaces (id) on delete set null,
  add column if not exists referred_at timestamptz;

update public.workspaces set referral_code = public.generar_codigo_referido() where referral_code is null;

create unique index if not exists workspaces_referral_code_uniq on public.workspaces (referral_code);
alter table public.workspaces
  add constraint workspaces_no_se_refiere_a_si_mismo check (referred_by is null or referred_by <> id);

create or replace function public.workspaces_codigo_referido()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generar_codigo_referido();
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_codigo_referido on public.workspaces;
create trigger workspaces_codigo_referido
  before insert on public.workspaces
  for each row execute function public.workspaces_codigo_referido();

-- Los miembros pueden actualizar su espacio (p. ej. elegir plan): sin esta guarda
-- podrian ponerse como "referido por" a quien quisieran o cambiarse el codigo.
-- Solo el servidor (sin sesion de usuario) y los administradores los tocan.
create or replace function public.workspaces_proteger_referidos()
returns trigger
language plpgsql
as $$
begin
  if (new.referral_code is distinct from old.referral_code
      or new.referred_by is distinct from old.referred_by
      or new.referred_at is distinct from old.referred_at)
     and auth.uid() is not null
     and not public.is_platform_admin() then
    raise exception 'Los datos de referidos no se pueden modificar.';
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_proteger_referidos on public.workspaces;
create trigger workspaces_proteger_referidos
  before update on public.workspaces
  for each row execute function public.workspaces_proteger_referidos();

-- ---------------------------------------------------------------- recompensas
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.workspaces (id) on delete cascade,
  referred_id uuid not null unique references public.workspaces (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  -- en_revision: parece autoreferido y lo decide el administrador.
  status text not null default 'disponible' check (status in ('en_revision', 'disponible', 'usado', 'rechazado')),
  motivo_revision text,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  resolved_at timestamptz,
  used_at timestamptz
);

create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer_id, status);
create index if not exists referral_rewards_por_avisar_idx on public.referral_rewards (created_at)
  where status = 'disponible' and notified_at is null;

alter table public.referral_rewards enable row level security;

create policy "referral_rewards_select" on public.referral_rewards
  for select using (public.is_workspace_member(referrer_id) or public.is_platform_admin());

-- ---------------------------------------------------------------- suscripciones
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('bold', 'manual', 'wompi', 'referido'));

-- ---------------------------------------------------------------- otorgar
-- Se llama al aprobarse un pago. Es idempotente: un referido solo da una
-- recompensa, y nunca pasan de 3 por quien refiere.
create or replace function public.otorgar_mes_por_referido(p_referido uuid, p_pago uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref uuid;
  v_total int;
  v_motivo text;
  a public.workspaces%rowtype;
  b public.workspaces%rowtype;
begin
  select referred_by into v_ref from public.workspaces where id = p_referido;
  if v_ref is null or v_ref = p_referido then return; end if;

  perform pg_advisory_xact_lock(hashtext('referidos:' || v_ref::text));

  if exists (select 1 from public.referral_rewards where referred_id = p_referido) then return; end if;

  select count(*) into v_total from public.referral_rewards
   where referrer_id = v_ref and status in ('en_revision', 'disponible', 'usado');
  if v_total >= 3 then return; end if;

  select * into a from public.workspaces where id = v_ref;
  select * into b from public.workspaces where id = p_referido;
  if a.id is null or b.id is null then return; end if;

  if a.signup_ip is not null and a.signup_ip = b.signup_ip then
    v_motivo := 'Se registraron desde la misma IP';
  elsif a.phone is not null and a.phone = b.phone then
    v_motivo := 'Tienen el mismo teléfono';
  elsif a.documento_numero is not null and a.documento_numero = b.documento_numero then
    v_motivo := 'Tienen el mismo documento legal';
  end if;

  insert into public.referral_rewards (referrer_id, referred_id, payment_id, status, motivo_revision)
  values (v_ref, p_referido, p_pago, case when v_motivo is null then 'disponible' else 'en_revision' end, v_motivo)
  on conflict (referred_id) do nothing;
end;
$$;

-- Que un fallo aqui nunca tumbe la aprobacion de un pago.
create or replace function public.payments_referido_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and new.amount_cents > 0
     and new.workspace_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    begin
      perform public.otorgar_mes_por_referido(new.workspace_id, new.id);
    exception when others then
      raise warning 'referidos: no se pudo otorgar el mes (%): %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_referido on public.payments;
create trigger payments_referido
  after insert or update of status on public.payments
  for each row execute function public.payments_referido_trigger();

-- ---------------------------------------------------------------- canjear
-- Usa un mes ganado: lo suma al final del periodo vigente (o empieza hoy si ya
-- vencio) y deja el espacio activo. Una sola operacion con bloqueo, para que dos
-- clics seguidos no den dos meses.
create or replace function public.canjear_mes_referido(p_workspace uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward uuid;
  v_base timestamptz;
  v_fin timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('referidos-canje:' || p_workspace::text));

  select id into v_reward from public.referral_rewards
   where referrer_id = p_workspace and status = 'disponible'
   order by created_at limit 1 for update;
  if v_reward is null then return null; end if;

  select greatest(now(), coalesce(max(current_period_end), now())) into v_base
    from public.subscriptions where workspace_id = p_workspace and status = 'active';
  v_fin := v_base + interval '1 month';

  insert into public.subscriptions (workspace_id, provider, external_id, status, current_period_end)
  values (p_workspace, 'referido', 'referido-' || v_reward::text, 'active', v_fin);

  update public.referral_rewards set status = 'usado', used_at = now() where id = v_reward;
  update public.workspaces set status = 'active', ever_activated = true
   where id = p_workspace and status <> 'active';
  return v_fin;
end;
$$;

-- ---------------------------------------------------------------- revision
create or replace function public.resolver_referido(p_reward uuid, p_aprobar boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.referral_rewards
     set status = case when p_aprobar then 'disponible' else 'rechazado' end,
         resolved_at = now(),
         notified_at = case when p_aprobar then null else notified_at end
   where id = p_reward and status = 'en_revision';
$$;

revoke all on function public.otorgar_mes_por_referido(uuid, uuid) from public, anon, authenticated;
revoke all on function public.canjear_mes_referido(uuid) from public, anon, authenticated;
revoke all on function public.resolver_referido(uuid, boolean) from public, anon, authenticated;
grant execute on function public.canjear_mes_referido(uuid) to service_role;
grant execute on function public.resolver_referido(uuid, boolean) to service_role;

notify pgrst, 'reload schema';
