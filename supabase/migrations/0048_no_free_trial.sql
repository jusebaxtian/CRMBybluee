-- New signups no longer get 7 free days — the workspace starts locked
-- ('past_due', same status a lapsed paid subscription gets) so the existing
-- billing lockout (middleware + dashboard layout) sends them straight to
-- /dashboard/billing to pay before they can use anything else.
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

  return new_workspace_id;
end;
$$;
