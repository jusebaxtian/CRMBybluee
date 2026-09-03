-- New automation step: "wait_for_reply" — pauses a sequence at that exact
-- point (no message sent, it's a pure gate) until the contact sends any
-- inbound message, then resumes from the next step. Distinct from the
-- no_reply follow-up mechanism (which fires ON silence) — this fires ON
-- a reply, with no time component at all.
alter table automation_actions
  drop constraint automation_actions_action_type_check;

alter table automation_actions
  add constraint automation_actions_action_type_check
  check (action_type = ANY (ARRAY[
    'send_message', 'add_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template', 'send_quick_reply', 'assign_agent',
    'assign_agent_random', 'wait_for_reply'
  ]));

create table automation_reply_waits (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  next_position integer not null,
  created_at timestamptz not null default now(),
  primary key (automation_id, contact_id)
);

alter table automation_reply_waits enable row level security;

create policy "automation_reply_waits_all" on automation_reply_waits
  using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());

grant select, insert, update, delete on automation_reply_waits to authenticated;

select pg_notify('pgrst', 'reload schema');
