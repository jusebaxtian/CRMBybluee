-- Follow-up sequences ("Seguimientos"): a new automation trigger_type,
-- "no_reply", fired when an outbound message goes unanswered. Reuses the
-- existing automations/automation_actions/automation_pending_runs engine
-- entirely — only the trigger mechanism differs (a DB trigger on messages,
-- instead of the JS runTagAddedAutomations/runKeywordAutomations calls) so
-- it fires for every current and future send path without having to hook
-- every call site individually.
alter table automations drop constraint automations_trigger_type_check;
alter table automations add constraint automations_trigger_type_check
  check (trigger_type = any(array['tag_added', 'keyword', 'no_reply']));

-- Per-conversation opt-out ("no le quiero hacer seguimiento a esta persona").
alter table conversations add column followups_enabled boolean not null default true;

-- Per-tag hard exclude — a contact tagged e.g. "No interesados" is fully
-- excluded from every follow-up sequence, checked both when scheduling and
-- again right before a deferred step actually fires.
alter table tags add column excludes_followups boolean not null default false;

-- Marks which automation (if any) produced a given outbound message. No FK
-- to automations(id) on purpose — quick replies also pass their own id
-- through the same executeAction code path, and that id lives in a
-- different table. The trigger below only cares whether this id happens to
-- match a 'no_reply' automation; any other value (a quick_reply id, a
-- tag/keyword automation id, or null for a manual send) is treated the same.
alter table messages add column via_automation_id uuid;

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

drop trigger if exists messages_followups_trigger on messages;
create trigger messages_followups_trigger
  after insert on messages
  for each row execute function handle_message_for_followups();
