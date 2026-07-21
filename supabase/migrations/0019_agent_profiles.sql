-- Agent profiles: workspace owners/admins can create up to 3 users with the
-- "agent" role, whose job is to answer only the conversations assigned to
-- them. Conversations gain an assignee; automations can assign on trigger;
-- agents/owners can transfer between agents. Also enables a "settings" module.

insert into modules (key, name, description) values
  ('settings', 'Configuración', 'Perfiles de agentes de respuesta y ajustes del workspace')
on conflict (key) do nothing;

insert into plan_modules (plan_id, module_key)
select p.id, 'settings' from plans p
where not exists (
  select 1 from plan_modules pm where pm.plan_id = p.id and pm.module_key = 'settings'
);

alter table conversations
  add column assigned_agent_id uuid references auth.users (id) on delete set null;

create index conversations_assigned_agent_id_idx on conversations (assigned_agent_id);

-- Returns the caller's role in a workspace ('owner' | 'admin' | 'agent'), or
-- null if not a member. security definer so it can be used inside RLS
-- policies on other tables without recursing into workspace_members' own RLS.
create or replace function workspace_role(target_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from workspace_members
  where workspace_id = target_workspace_id and user_id = auth.uid()
  limit 1;
$$;

-- New conversations created by an agent (e.g. starting a chat with a
-- contact) are auto-assigned to that agent so they don't vanish from their
-- own view. Conversations created by the webhook (service-role client, no
-- auth.uid()) or by owners/admins stay unassigned until assigned manually
-- or by an automation.
create or replace function set_conversation_agent_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_agent_id is null and workspace_role(new.workspace_id) = 'agent' then
    new.assigned_agent_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger conversations_default_agent
  before insert on conversations
  for each row execute function set_conversation_agent_default();

-- Replace the flat "any member sees everything" policy with role-aware
-- access: owners/admins/platform admins see every conversation; agents see
-- only the ones assigned to them.
drop policy "conversations_all" on conversations;

create policy "conversations_select" on conversations
  for select using (
    is_platform_admin()
    or workspace_role(workspace_id) in ('owner', 'admin')
    or (workspace_role(workspace_id) = 'agent' and assigned_agent_id = auth.uid())
  );

create policy "conversations_insert" on conversations
  for insert with check (is_workspace_member(workspace_id));

-- USING gates which rows can be touched (same visibility as select). WITH
-- CHECK is deliberately looser than USING: it only re-checks membership, not
-- assigned_agent_id, so an agent reassigning their own conversation to a
-- different agent (a transfer) isn't blocked by the new row no longer
-- matching "assigned to me".
create policy "conversations_update" on conversations
  for update using (
    is_platform_admin()
    or workspace_role(workspace_id) in ('owner', 'admin')
    or (workspace_role(workspace_id) = 'agent' and assigned_agent_id = auth.uid())
  )
  with check (is_workspace_member(workspace_id) or is_platform_admin());

create policy "conversations_delete" on conversations
  for delete using (is_platform_admin() or workspace_role(workspace_id) in ('owner', 'admin'));

-- Messages inherit the same visibility as their conversation.
create or replace function is_workspace_member_via_conversation(target_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from conversations c
    where c.id = target_conversation_id
      and (
        is_platform_admin()
        or workspace_role(c.workspace_id) in ('owner', 'admin')
        or (workspace_role(c.workspace_id) = 'agent' and c.assigned_agent_id = auth.uid())
      )
  );
$$;

-- Agents assigning a conversation to another agent (transfer) via automations.
alter table automation_actions
  add column target_agent_id uuid references auth.users (id) on delete set null;

alter table automation_actions drop constraint automation_actions_action_type_check;
alter table automation_actions add constraint automation_actions_action_type_check
  check (action_type in (
    'send_message', 'add_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template', 'assign_agent'
  ));
