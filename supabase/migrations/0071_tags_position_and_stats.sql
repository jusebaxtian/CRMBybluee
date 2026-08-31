-- New "Etiquetas" table on the Dashboard: tag, contact count, % of total,
-- drag-to-reorder. Needs a persisted order (didn't exist before) and an
-- efficient way to count contacts per tag without an N+1 query per tag.

alter table tags add column if not exists position integer;

-- Backfill existing tags with a stable order (alphabetical) per workspace.
with ordered as (
  select id, row_number() over (partition by workspace_id order by name) - 1 as rn
  from tags
  where position is null
)
update tags t set position = o.rn from ordered o where o.id = t.id;

alter table tags alter column position set default 0;
alter table tags alter column position set not null;

create or replace function tag_contact_counts(p_workspace_id uuid)
returns table(tag_id uuid, contact_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ct.tag_id, count(distinct ct.contact_id) as contact_count
  from contact_tags ct
  join tags t on t.id = ct.tag_id
  where t.workspace_id = p_workspace_id
  group by ct.tag_id;
$$;
