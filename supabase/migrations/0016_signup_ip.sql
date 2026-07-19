-- Track the IP address a workspace signed up from, so the admin panel can
-- flag likely multi-accounting (several trial workspaces from one IP).

alter table workspaces add column signup_ip text;

create or replace function create_workspace_with_owner(workspace_name text, signup_ip text default null)
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

  insert into workspaces (name, plan_id, signup_ip)
  values (workspace_name, starter_plan_id, signup_ip)
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

grant execute on function create_workspace_with_owner(text, text) to authenticated;
