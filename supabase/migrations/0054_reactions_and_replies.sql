-- Supports two related WhatsApp features that were showing as an empty
-- bubble or weren't possible at all:
--   1. Reactions (👍/❤️/etc. on a message) arrive as message.type = "reaction"
--      with no text body, so messageBody ended up null and rendered empty.
--   2. Quoted replies ("swipe to reply") carry a context.id pointing at the
--      message being replied to — both inbound (customer replied) and
--      outbound (agent replies from the composer).
-- One column covers both: for a reaction it's the message being reacted to,
-- for a reply it's the message being quoted.
alter table messages add column context_wa_message_id text;
