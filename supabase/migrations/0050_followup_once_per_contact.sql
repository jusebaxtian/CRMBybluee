-- Bug fix: any qualifying outbound message (AI chat reply, another
-- automation, etc.) was resetting a no_reply follow-up sequence back to its
-- first step — a contact could get the same "step 1" message sent over and
-- over for days instead of the sequence ever progressing past it. Now each
-- (automation, contact) pair starts the sequence at most once ever; once
-- started, later outbound messages neither cancel nor restart it — only a
-- real reply from the contact still cancels a pending step.
create table automation_starts (
  automation_id uuid not null references automations (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (automation_id, contact_id)
);

alter table automation_starts enable row level security;

create policy "automation_starts_all" on automation_starts
  for all using (is_workspace_member_via_automation(automation_id))
  with check (is_workspace_member_via_automation(automation_id));

-- Backfill: don't let contacts who've already received at least one message
-- from a no_reply sequence (or have one scheduled) get restarted from
-- scratch now that this is fixed.
insert into automation_starts (automation_id, contact_id)
select distinct m.via_automation_id, conv.contact_id
from messages m
join conversations conv on conv.id = m.conversation_id
join automations a on a.id = m.via_automation_id and a.trigger_type = 'no_reply'
on conflict do nothing;

insert into automation_starts (automation_id, contact_id)
select apr.automation_id, apr.contact_id
from automation_pending_runs apr
join automations a on a.id = apr.automation_id and a.trigger_type = 'no_reply'
on conflict do nothing;

create or replace function handle_message_for_followups() returns trigger as $$
declare
  ws_id uuid;
  c_id uuid;
  is_followup_step boolean;
begin
  select workspace_id, contact_id into ws_id, c_id
  from conversations where id = new.conversation_id;
  if ws_id is null then
    return new;
  end if;

  if new.direction = 'in' then
    delete from automation_pending_runs
    where contact_id = c_id
      and automation_id in (
        select id from automations where workspace_id = ws_id and trigger_type = 'no_reply'
      );
    return new;
  end if;

  if new.exclude_from_followups then
    return new;
  end if;

  is_followup_step := new.via_automation_id is not null and exists (
    select 1 from automations where id = new.via_automation_id and trigger_type = 'no_reply'
  );
  if is_followup_step then
    return new;
  end if;

  if exists (select 1 from conversations where id = new.conversation_id and followups_enabled = false) then
    return new;
  end if;

  if exists (
    select 1 from contact_tags ct
    join tags t on t.id = ct.tag_id
    where ct.contact_id = c_id and t.excludes_followups
  ) then
    return new;
  end if;

  if exists (select 1 from contacts where id = c_id and likely_blocked) then
    return new;
  end if;

  insert into automation_pending_runs (workspace_id, automation_id, contact_id, next_position, run_at)
  select ws_id, a.id, c_id, first_step.position,
         new.created_at + make_interval(secs => first_step.delay_seconds)
  from automations a
  join lateral (
    select position, delay_seconds from automation_actions
    where automation_id = a.id order by position asc limit 1
  ) first_step on true
  where a.workspace_id = ws_id and a.trigger_type = 'no_reply' and a.is_active = true
    and first_step.delay_seconds > 0
    and not exists (
      select 1 from automation_starts s where s.automation_id = a.id and s.contact_id = c_id
    );

  insert into automation_starts (automation_id, contact_id)
  select a.id, c_id
  from automations a
  where a.workspace_id = ws_id and a.trigger_type = 'no_reply' and a.is_active = true
    and not exists (
      select 1 from automation_starts s where s.automation_id = a.id and s.contact_id = c_id
    )
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
