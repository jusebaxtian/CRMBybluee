-- Counterpart to expireTrials() (trialing -> past_due) that didn't exist:
-- nothing ever flipped a paying "active" workspace to "past_due" when its
-- renewal date passed — confirmed via direct query, no active workspace
-- was overdue yet, but the mechanism to catch it when one is was entirely
-- missing. A workspace can have several subscriptions rows over time (each
-- renewal inserts a new one instead of updating the old), so "the real
-- renewal date" is the latest current_period_end among its active-status
-- subscriptions, not any single row.
create or replace function expire_lapsed_active_subscriptions()
returns void
language sql
security definer
set search_path = public
as $$
  update workspaces w
  set status = 'past_due'
  where w.status = 'active'
    and w.id in (
      select s.workspace_id
      from subscriptions s
      where s.status = 'active'
      group by s.workspace_id
      having max(s.current_period_end) < now()
    );
$$;
