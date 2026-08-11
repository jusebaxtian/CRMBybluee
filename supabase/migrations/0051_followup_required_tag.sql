-- Lets a follow-up sequence (trigger_type='no_reply') only activate for
-- contacts that carry a specific tag — null means "everyone", matching
-- the previous behavior.
alter table automations add column required_tag_id uuid references tags (id) on delete set null;

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
    )
    and (
      a.required_tag_id is null
      or exists (
        select 1 from contact_tags ct where ct.contact_id = c_id and ct.tag_id = a.required_tag_id
      )
    );

  insert into automation_starts (automation_id, contact_id)
  select a.id, c_id
  from automations a
  where a.workspace_id = ws_id and a.trigger_type = 'no_reply' and a.is_active = true
    and not exists (
      select 1 from automation_starts s where s.automation_id = a.id and s.contact_id = c_id
    )
    and (
      a.required_tag_id is null
      or exists (
        select 1 from contact_tags ct where ct.contact_id = c_id and ct.tag_id = a.required_tag_id
      )
    )
  on conflict do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
