-- Keyword automations now dedupe via automation_starts (once per contact,
-- ever — see runKeywordAutomations in engine.ts), same as no_reply
-- follow-ups already did. Backfill starts for keyword automations that
-- already ran historically, so a contact who already got the flow before
-- this fix doesn't get it retriggered by their next "hola".
insert into automation_starts (automation_id, contact_id)
select distinct m.via_automation_id, c.contact_id
from messages m
join conversations c on c.id = m.conversation_id
join automations a on a.id = m.via_automation_id
where a.trigger_type = 'keyword'
on conflict do nothing;
