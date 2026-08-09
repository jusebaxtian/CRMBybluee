-- Follow-ups become a sequence of steps, each with its own delay and its
-- own strategic focus (e.g. "invitar al grupo", "enviar testimonios"),
-- instead of one repeated generic message. followup_delay_minutes /
-- followup_max_attempts stay in place but are no longer read by the app.
alter table ai_agents add column followup_steps jsonb not null default '[]'::jsonb;

-- Anchors when the current silence started, so step delays are measured
-- from "the customer went quiet" rather than from our own last follow-up
-- (which would otherwise keep pushing the anchor forward on every send).
alter table conversations add column ai_followup_started_at timestamptz;

create or replace function sync_conversation_for_ai_followups() returns trigger as $$
begin
  if new.direction = 'out' then
    update conversations
      set last_message_direction = 'out',
          ai_followup_started_at = case
            when last_message_direction is distinct from 'out' then new.created_at
            else ai_followup_started_at
          end
      where id = new.conversation_id;
  else
    update conversations
      set last_message_direction = 'in',
          ai_followup_count = 0,
          ai_followup_started_at = null
      where id = new.conversation_id;
  end if;
  return new;
end;
$$ language plpgsql;

-- Backfill: conversations currently silent (last message outbound) start
-- their anchor at last_message_at, same as if the trigger had run then.
update conversations
set ai_followup_started_at = last_message_at
where last_message_direction = 'out' and ai_followup_started_at is null;
