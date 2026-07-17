-- Atomically create a workspace + owner membership for the calling user on signup.
-- security definer bypasses RLS for this one controlled operation; RLS still governs
-- everything else, since it inserts exactly one workspace owned by auth.uid().

create or replace function create_workspace_with_owner(workspace_name text)
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

  insert into workspaces (name, plan_id)
  values (workspace_name, starter_plan_id)
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

grant execute on function create_workspace_with_owner(text) to authenticated;
