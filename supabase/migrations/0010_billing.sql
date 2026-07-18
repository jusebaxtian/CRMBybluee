-- Subscriptions and payments (Bold + manual bank transfer).

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  provider text not null check (provider in ('bold', 'manual')),
  external_id text,
  status text not null default 'active' check (status in ('active', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  provider text not null check (provider in ('bold', 'manual')),
  amount_cents bigint not null,
  currency text not null default 'COP',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  bold_order_id text,
  proof_path text, -- storage path for manual transfer receipts
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table subscriptions enable row level security;
alter table payments enable row level security;

create policy "subscriptions_select" on subscriptions
  for select using (is_workspace_member(workspace_id) or is_platform_admin());

create policy "subscriptions_admin_write" on subscriptions
  for all using (is_platform_admin()) with check (is_platform_admin());

create policy "payments_select" on payments
  for select using (is_workspace_member(workspace_id) or is_platform_admin());

create policy "payments_insert" on payments
  for insert with check (is_workspace_member(workspace_id) or is_platform_admin());

create policy "payments_admin_update" on payments
  for update using (is_platform_admin());

-- Private bucket for manual-transfer receipts; only our server code (service role)
-- reads/writes it, so no public storage policies are needed.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;
