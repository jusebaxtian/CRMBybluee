-- Stores why a WhatsApp delivery failed (e.g. "more than 24 hours have
-- passed since the customer last replied") so the failed-message icon in
-- the chat can show a real reason on hover instead of nothing.
alter table messages add column error_detail text;
