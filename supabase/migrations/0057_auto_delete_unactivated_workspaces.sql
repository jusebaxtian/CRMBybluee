-- Auto-deletes workspaces that never once activated (never had a
-- successful payment) and have sat in past_due for 7+ days. Deliberately
-- scoped to ONLY workspaces that never activated — a workspace that paid
-- before and later lapsed is protected and requires manual review, per
-- explicit product decision.
alter table workspaces add column ever_activated boolean not null default false;

-- Backfill: anyone currently active, or with any historical active
-- subscription/approved payment, counts as having activated at least once.
update workspaces set ever_activated = true where status = 'active';
update workspaces w set ever_activated = true
where exists (select 1 from subscriptions s where s.workspace_id = w.id and s.status = 'active');
update workspaces w set ever_activated = true
where exists (select 1 from payments p where p.workspace_id = w.id and p.status = 'approved');

-- Once true, stays true — a workspace shouldn't lose its "has paid before"
-- protection just because its status later changes.
create or replace function mark_workspace_activated() returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' then
    new.ever_activated := true;
  end if;
  return new;
end;
$$;

create trigger workspaces_mark_activated
before insert or update on workspaces
for each row execute function mark_workspace_activated();
