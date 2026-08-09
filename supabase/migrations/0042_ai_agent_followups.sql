-- AI-driven automatic follow-ups: the agent itself detects a conversation
-- with no reply and writes a follow-up (free text inside the 24h customer
-- service window, or a fixed approved template outside it).
alter table ai_agents add column followup_enabled boolean not null default false;
alter table ai_agents add column followup_delay_minutes int not null default 1440;
alter table ai_agents add column followup_max_attempts int not null default 1;
alter table ai_agents add column followup_template_id uuid references templates(id) on delete set null;

-- How many auto follow-ups have fired since the customer's last reply —
-- reset to 0 on any inbound message, so a real reply always resets the count.
alter table conversations add column ai_followup_count int not null default 0;

-- The follow-up scheduler needs to know whether the LAST message in a
-- conversation was outbound (candidate for a follow-up) without scanning
-- messages for every conversation on every poll tick.
alter table conversations add column last_message_direction text;

create or replace function sync_conversation_for_ai_followups() returns trigger as $$
begin
  update conversations
    set last_message_direction = new.direction,
        ai_followup_count = case when new.direction = 'in' then 0 else ai_followup_count end
    where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

create trigger messages_ai_followup_sync_trigger
  after insert on messages
  for each row
  execute function sync_conversation_for_ai_followups();

-- Backfill existing conversations so the scheduler has correct data from day one.
update conversations c
set last_message_direction = m.direction
from (
  select distinct on (conversation_id) conversation_id, direction
  from messages
  order by conversation_id, created_at desc
) m
where m.conversation_id = c.id;
