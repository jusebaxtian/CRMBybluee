-- campaign_recipients was only ever marked "sent" (Meta accepted the API
-- call) and never updated when the async delivery-status webhook later
-- reported a real failure (e.g. error 131049 "healthy ecosystem engagement"
-- throttling, or 130472 "part of an experiment") — campaign reports showed
-- everything as sent even when a chunk of it silently never arrived.
alter table campaign_recipients add column wa_message_id text;
create index campaign_recipients_wa_message_id_idx on campaign_recipients(wa_message_id);
