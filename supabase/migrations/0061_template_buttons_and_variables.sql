-- Adds three related pieces requested together: (1) buttons on approved
-- Meta templates (URL, with an optional dynamic variable, or Quick Reply),
-- (2) buttons on session messages sent from automations/quick replies
-- (interactive reply buttons, no Meta approval needed), and (3) a new
-- automation trigger for when a contact taps one of those buttons.

-- 1. Templates: buttons as approved by Meta. Shape:
--    [{ "type": "URL", "text": "Ver más", "url": "https://x.com/{{1}}" }]
--    [{ "type": "QUICK_REPLY", "text": "Sí, me interesa" }]
alter table templates add column buttons jsonb;

-- 2. Session-message buttons for automation/quick-reply "send_message"
--    actions — up to 3 interactive reply buttons, each { id, title }.
alter table automation_actions add column buttons jsonb;
alter table quick_reply_actions add column buttons jsonb;

-- 3. New trigger type: fires when a contact taps a button (either a
-- template Quick Reply button or a session interactive button carrying a
-- matching id/payload). Reuses trigger_keyword to store the button
-- id/payload to match — exact match, unlike the "keyword" trigger's
-- substring match, since button payloads are identifiers, not free text.
alter table automations drop constraint automations_trigger_type_check;
alter table automations add constraint automations_trigger_type_check
  check (trigger_type = any(array['tag_added', 'keyword', 'no_reply', 'button_tap']));
