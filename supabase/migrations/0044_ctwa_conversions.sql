-- Closes the loop with Meta's Conversions API for Click-to-WhatsApp ads:
-- when a contact who arrived from a WhatsApp ad gets tagged with a
-- "marks_purchase" tag, we report a Purchase event back to Meta using the
-- ctwa_clid captured on their conversation, so Ads Manager can optimize
-- delivery toward people who actually buy.
alter table tags add column marks_purchase boolean not null default false;
alter table whatsapp_accounts add column ctwa_dataset_id text;
