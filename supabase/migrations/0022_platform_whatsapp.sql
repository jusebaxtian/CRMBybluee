-- Platform-level WhatsApp: a dedicated WhatsApp Business number, independent
-- from each customer workspace's own connection, used by platform admins to
-- send template-message notifications (e.g. "your plan was activated") when
-- they take a manual action in /admin, not tied to any single workspace.

alter table workspaces add column phone text;

-- Signup collects a WhatsApp number so this notification can be sent before
-- the client ever connects their own WhatsApp Business API.
create or replace function create_workspace_with_owner(
  workspace_name text,
  signup_ip text default null,
  phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  starter_plan_id uuid;
begin
  select id into starter_plan_id from plans where name = 'Starter' limit 1;

  insert into workspaces (name, plan_id, signup_ip, phone)
  values (workspace_name, starter_plan_id, signup_ip, phone)
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

grant execute on function create_workspace_with_owner(text, text, text) to authenticated;

create table platform_whatsapp_account (
  id uuid primary key default gen_random_uuid(),
  waba_id text not null,
  phone_number_id text not null,
  display_phone_number text,
  access_token text not null,
  status text not null default 'connected',
  connected_at timestamptz not null default now()
);

create table platform_templates (
  id uuid primary key default gen_random_uuid(),
  meta_template_name text not null,
  language text not null,
  category text,
  status text,
  body_text text,
  variable_count int not null default 0,
  synced_at timestamptz not null default now(),
  unique (meta_template_name, language)
);

alter table platform_whatsapp_account enable row level security;
alter table platform_templates enable row level security;

create policy "platform_whatsapp_account_admin" on platform_whatsapp_account
  for all using (is_platform_admin()) with check (is_platform_admin());

create policy "platform_templates_admin" on platform_templates
  for all using (is_platform_admin()) with check (is_platform_admin());
