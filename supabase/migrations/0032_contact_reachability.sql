-- WhatsApp doesn't tell businesses when a customer blocks them (privacy) —
-- the closest signal is repeated delivery failures with error 131026
-- ("recipient's number is not on WhatsApp or is otherwise unreachable").
-- Tracking consecutive failures per contact and flagging them after a few
-- in a row protects the account's quality rating by stopping automated
-- sends (follow-ups, mass campaigns) to numbers that likely can't be
-- reached — sending into a wall of failures only hurts the sender's score.
alter table contacts add column consecutive_failures integer not null default 0;
alter table contacts add column likely_blocked boolean not null default false;

-- Update the follow-ups trigger to also respect likely_blocked.
create or replace function handle_message_for_followups() returns trigger
language plpgsql security definer set search_path = public
as $$
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

  delete from automation_pending_runs
  where contact_id = c_id
    and automation_id in (
      select id from automations where workspace_id = ws_id and trigger_type = 'no_reply'
    );

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
    and first_step.delay_seconds > 0;

  return new;
end;
$$;
