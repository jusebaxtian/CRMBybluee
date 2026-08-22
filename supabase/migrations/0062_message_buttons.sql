-- An outbound interactive-button message was being stored as plain
-- message_type "text" with no record of the buttons it actually carried —
-- the CRM chat view had no way to show what buttons were offered, and a
-- customer's later button tap (already rendered as its own "🔘 Tocó: X"
-- bubble) had nothing to visually connect back to. Same shape as
-- automation_actions.buttons/quick_reply_actions.buttons.
alter table messages add column buttons jsonb;
