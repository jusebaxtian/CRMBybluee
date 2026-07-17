-- Automations: trigger (tag added to a contact, or keyword in an incoming message)
-- followed by an ordered list of actions (send message, add tag).

create table automations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('tag_added', 'keyword')),
  trigger_tag_id uuid references tags (id) on delete cascade,
  trigger_keyword text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table automation_actions (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations (id) on delete cascade,
  position int not null,
  action_type text not null check (action_type in ('send_message', 'add_tag')),
  message_body text,
  tag_id uuid references tags (id)
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create or replace function is_workspace_member_via_automation(target_automation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from automations a
    where a.id = target_automation_id
      and (is_workspace_member(a.workspace_id) or is_platform_admin())
  );
$$;

alter table automations enable row level security;
alter table automation_actions enable row level security;
alter table automation_runs enable row level security;

create policy "automations_all" on automations
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

create policy "automation_actions_all" on automation_actions
  for all using (is_workspace_member_via_automation(automation_id))
  with check (is_workspace_member_via_automation(automation_id));

create policy "automation_runs_select" on automation_runs
  for select using (is_workspace_member_via_automation(automation_id));

create policy "automation_runs_insert" on automation_runs
  for insert with check (is_workspace_member_via_automation(automation_id));
