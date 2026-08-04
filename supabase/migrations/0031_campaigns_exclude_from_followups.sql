-- Mass campaigns (template or free_text) must run fully independent of
-- follow-up sequences: they must not cancel an in-progress sequence, reset
-- its clock, or start a new one for a contact who wasn't already in one.
alter table messages add column exclude_from_followups boolean not null default false;

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
    -- The contact replied — any pending follow-up for them is moot.
    delete from automation_pending_runs
    where contact_id = c_id
      and automation_id in (
        select id from automations where workspace_id = ws_id and trigger_type = 'no_reply'
      );
    return new;
  end if;

  -- direction = 'out' from here on.
  if new.exclude_from_followups then
    -- A mass campaign send — leave any in-progress sequence exactly as it
    -- was, and don't start a new one either.
    return new;
  end if;

  is_followup_step := new.via_automation_id is not null and exists (
    select 1 from automations where id = new.via_automation_id and trigger_type = 'no_reply'
  );
  if is_followup_step then
    -- This message IS a follow-up step firing — the engine's own delay
    -- machinery (runFrom/resumeAutomationRun) already scheduled whatever
    -- comes next in the sequence. Restarting it here would loop forever.
    return new;
  end if;

  -- Any other outbound message (manual, quick reply, tag/keyword automation)
  -- restarts the "time since last reply" clock for every active sequence.
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

  -- Schedule the first step of every active sequence. A sequence whose
  -- first step has no delay is skipped (nothing to schedule synchronously
  -- from SQL) — the create/edit form requires a delay > 0 on the first step.
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
