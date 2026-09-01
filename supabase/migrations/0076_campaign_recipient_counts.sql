-- Aggregated per-campaign send results (sent/delivered/read vs failed vs
-- pending), for the campaigns list page. Returns one row per campaign —
-- aggregation happens in SQL so this never hits PostgREST's 1000-row cap,
-- unlike fetching campaign_recipients directly for campaigns with 1000+
-- recipients.
create or replace function campaign_recipient_counts(p_workspace_id uuid)
returns table (
  campaign_id uuid,
  sent_count bigint,
  failed_count bigint,
  pending_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cr.campaign_id,
    count(*) filter (where cr.status in ('sent', 'delivered', 'read')) as sent_count,
    count(*) filter (where cr.status = 'failed') as failed_count,
    count(*) filter (where cr.status = 'pending') as pending_count
  from campaign_recipients cr
  join campaigns c on c.id = cr.campaign_id
  where c.workspace_id = p_workspace_id
    and (is_workspace_member(p_workspace_id) or is_platform_admin())
  group by cr.campaign_id;
$$;

grant execute on function campaign_recipient_counts(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
