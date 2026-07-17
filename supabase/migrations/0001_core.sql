-- Core tables: platform admins, plans/modules catalog, workspaces (tenants), members.

create extension if not exists "pgcrypto";

-- Platform admins: staff of Bybluee (the SaaS owner), not tenant users.
create table platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from platform_admins where user_id = auth.uid()
  );
$$;

-- Plans catalog (e.g. "Starter $150.000").
create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents bigint not null,
  currency text not null default 'COP',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Modules catalog (feature flags sellable per plan).
create table modules (
  key text primary key,
  name text not null,
  description text
);

insert into modules (key, name, description) values
  ('inbox', 'Bandeja de conversaciones', 'Ver y responder conversaciones de WhatsApp'),
  ('contacts', 'Gestión de contactos', 'CRUD de contactos, etiquetas y segmentación'),
  ('campaigns', 'Envíos masivos', 'Importación, plantillas y campañas programadas'),
  ('automations', 'Automatizaciones', 'Flujos de seguimiento y recordatorios automáticos');

-- Which modules each plan includes, plus optional numeric limits (e.g. max_contacts).
create table plan_modules (
  plan_id uuid not null references plans (id) on delete cascade,
  module_key text not null references modules (key) on delete cascade,
  limits jsonb not null default '{}'::jsonb,
  primary key (plan_id, module_key)
);

-- Workspaces = tenants (one per customer company).
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid references plans (id),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- Users <-> workspace membership with role.
create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'agent')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

-- RLS
alter table platform_admins enable row level security;
alter table plans enable row level security;
alter table modules enable row level security;
alter table plan_modules enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- platform_admins: only platform admins can read/write.
create policy "platform_admins_select" on platform_admins for select using (is_platform_admin());
create policy "platform_admins_all" on platform_admins for all using (is_platform_admin()) with check (is_platform_admin());

-- plans/modules/plan_modules: public read (needed for pricing page), writes restricted to platform admins.
create policy "plans_public_read" on plans for select using (true);
create policy "plans_admin_write" on plans for insert with check (is_platform_admin());
create policy "plans_admin_update" on plans for update using (is_platform_admin());
create policy "plans_admin_delete" on plans for delete using (is_platform_admin());

create policy "modules_public_read" on modules for select using (true);
create policy "modules_admin_write" on modules for all using (is_platform_admin()) with check (is_platform_admin());

create policy "plan_modules_public_read" on plan_modules for select using (true);
create policy "plan_modules_admin_write" on plan_modules for all using (is_platform_admin()) with check (is_platform_admin());

-- workspaces: members can read their own workspace; platform admins can read/write all (support mode).
create policy "workspaces_member_select" on workspaces for select using (is_workspace_member(id) or is_platform_admin());
create policy "workspaces_admin_write" on workspaces for insert with check (is_platform_admin() or true);
create policy "workspaces_owner_update" on workspaces for update using (is_workspace_member(id) or is_platform_admin());
create policy "workspaces_admin_delete" on workspaces for delete using (is_platform_admin());

-- workspace_members: members can see their own workspace's member list; platform admins see all.
create policy "workspace_members_select" on workspace_members for select using (is_workspace_member(workspace_id) or is_platform_admin());
create policy "workspace_members_insert" on workspace_members for insert with check (is_workspace_member(workspace_id) or is_platform_admin());
create policy "workspace_members_delete" on workspace_members for delete using (is_workspace_member(workspace_id) or is_platform_admin());

-- Seed the initial $150.000 plan with all modules included.
insert into plans (name, price_cents, currency, billing_cycle)
values ('Starter', 15000000, 'COP', 'monthly');

insert into plan_modules (plan_id, module_key)
select p.id, m.key from plans p cross join modules m where p.name = 'Starter';
