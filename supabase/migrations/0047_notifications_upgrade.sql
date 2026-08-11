-- Notifications module upgrade: scheduling window (starts_at/ends_at),
-- targeting by account status (in addition to the existing all/workspace/plan
-- scope), an optional CTA button, and realtime delivery so the bell/sound
-- update live instead of only on next navigation. Retention (auto-delete
-- after a minimum of 20 days) is handled by a scheduler job, not a DB trigger.
alter table notifications add column starts_at timestamptz not null default now();
alter table notifications add column ends_at timestamptz;
alter table notifications add column target_status text
  check (target_status in ('trialing', 'active', 'past_due', 'canceled'));
alter table notifications add column cta_label text;
alter table notifications add column cta_url text;

alter table notifications drop constraint notifications_scope_check;
alter table notifications add constraint notifications_scope_check
  check (scope in ('all', 'workspace', 'plan', 'status'));

drop policy "notifications_read" on notifications;
create policy "notifications_read" on notifications
  for select using (
    is_platform_admin()
    or scope = 'all'
    or (scope = 'workspace' and is_workspace_member(target_workspace_id))
    or (scope = 'plan' and exists (
      select 1 from workspaces w
      where w.plan_id = target_plan_id and is_workspace_member(w.id)
    ))
    or (scope = 'status' and exists (
      select 1 from workspaces w
      where w.status = target_status and is_workspace_member(w.id)
    ))
  );

alter publication supabase_realtime add table notifications;
