-- Admin support-access audit log, and platform-wide notifications to clients.

create table admin_access_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  accessed_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  scope text not null default 'all' check (scope in ('all', 'workspace', 'plan')),
  target_workspace_id uuid references workspaces (id) on delete cascade,
  target_plan_id uuid references plans (id) on delete cascade,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table notification_reads (
  notification_id uuid not null references notifications (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, workspace_id)
);

alter table admin_access_logs enable row level security;
alter table notifications enable row level security;
alter table notification_reads enable row level security;

-- Only platform admins can see/write access logs.
create policy "admin_access_logs_admin_only" on admin_access_logs
  for all using (is_platform_admin()) with check (is_platform_admin());

-- Notifications: platform admins manage them; any workspace member can read notifications
-- scoped to "all", their workspace, or their plan.
create policy "notifications_admin_write" on notifications
  for insert with check (is_platform_admin());

create policy "notifications_admin_update" on notifications
  for update using (is_platform_admin());

create policy "notifications_admin_delete" on notifications
  for delete using (is_platform_admin());

create policy "notifications_read" on notifications
  for select using (
    is_platform_admin()
    or scope = 'all'
    or (scope = 'workspace' and is_workspace_member(target_workspace_id))
    or (scope = 'plan' and exists (
      select 1 from workspaces w
      where w.plan_id = target_plan_id and is_workspace_member(w.id)
    ))
  );

create policy "notification_reads_all" on notification_reads
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));
