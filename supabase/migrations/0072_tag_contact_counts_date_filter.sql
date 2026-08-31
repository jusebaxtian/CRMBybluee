-- Adds an optional contact-created-date range to the Dashboard's tag stats
-- table (e.g. "solo contactos que llegaron esta semana"), same
-- creation-date filter idea already used for campaign audiences.
create or replace function tag_contact_counts(
  p_workspace_id uuid,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null
)
returns table(tag_id uuid, contact_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ct.tag_id, count(distinct ct.contact_id) as contact_count
  from contact_tags ct
  join tags t on t.id = ct.tag_id
  join contacts c on c.id = ct.contact_id
  where t.workspace_id = p_workspace_id
    and (p_created_from is null or c.created_at >= p_created_from)
    and (p_created_to is null or c.created_at <= p_created_to)
  group by ct.tag_id;
$$;
