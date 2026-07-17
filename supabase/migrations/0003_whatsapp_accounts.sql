-- WhatsApp Business account connected to a workspace via Embedded Signup.

create table whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null,
  display_phone_number text,
  access_token text not null,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error')),
  connected_at timestamptz not null default now(),
  unique (workspace_id)
);

alter table whatsapp_accounts enable row level security;

create policy "whatsapp_accounts_select" on whatsapp_accounts
  for select using (is_workspace_member(workspace_id) or is_platform_admin());

create policy "whatsapp_accounts_insert" on whatsapp_accounts
  for insert with check (is_workspace_member(workspace_id));

create policy "whatsapp_accounts_update" on whatsapp_accounts
  for update using (is_workspace_member(workspace_id) or is_platform_admin());

create policy "whatsapp_accounts_delete" on whatsapp_accounts
  for delete using (is_workspace_member(workspace_id) or is_platform_admin());
