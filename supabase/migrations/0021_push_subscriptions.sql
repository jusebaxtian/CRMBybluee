-- Web Push subscriptions for dashboard users (mainly agents on the Android
-- PWA), used to notify about new inbound WhatsApp messages.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_select" on push_subscriptions
  for select using (user_id = auth.uid());

create policy "push_subscriptions_insert" on push_subscriptions
  for insert with check (user_id = auth.uid());

create policy "push_subscriptions_delete" on push_subscriptions
  for delete using (user_id = auth.uid());
