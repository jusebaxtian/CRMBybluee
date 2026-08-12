-- Richer campaign audience targeting: multiple tags (OR match), tag
-- exclusions (contact dropped if it carries ANY excluded tag, even if it
-- also matches an included tag), and a contact creation-date range.
-- audience_tag_id (single) stays for old rows/back-compat but new campaigns
-- write the array columns.
alter table campaigns add column audience_tag_ids uuid[];
alter table campaigns add column audience_exclude_tag_ids uuid[];
alter table campaigns add column audience_created_from timestamptz;
alter table campaigns add column audience_created_to timestamptz;

-- Every workspace gets a ready-made "No seguimientos" tag with
-- excludes_followups = true, so an owner always has a tag on hand to stop a
-- contact from getting automated follow-ups without having to create one
-- from scratch. Exclusion already takes priority over inclusion in
-- handle_message_for_followups() (any matching excludes_followups tag skips
-- the contact regardless of other tags), so this just seeds the tag itself.
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

  insert into workspaces (name, plan_id, signup_ip, phone, status)
  values (workspace_name, starter_plan_id, signup_ip, phone, 'past_due')
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  insert into tags (workspace_id, name, color, excludes_followups)
  values (new_workspace_id, 'No seguimientos', '#ef4444', true);

  return new_workspace_id;
end;
$$;

insert into tags (workspace_id, name, color, excludes_followups)
select w.id, 'No seguimientos', '#ef4444', true
from workspaces w
where not exists (
  select 1 from tags t where t.workspace_id = w.id and t.excludes_followups = true
);
