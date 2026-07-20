-- Lets each automation action wait N seconds before running (so a flow can
-- pace itself instead of firing everything at once), and adds a table to
-- track actions that are scheduled for later so an in-process poller can
-- resume them.

alter table automation_actions add column delay_seconds integer not null default 0;

create table automation_pending_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  automation_id uuid not null references automations (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  next_position int not null,
  run_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index automation_pending_runs_run_at_idx on automation_pending_runs (run_at);

alter table automation_pending_runs enable row level security;

create policy "automation_pending_runs_all" on automation_pending_runs
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());
