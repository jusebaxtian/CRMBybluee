-- Two new automation triggers:
--   'any_message'          — any inbound message from the contact (not
--                             restricted to a keyword), once per contact ever.
--   'first_message_of_day' — the contact's first message of the current
--                             calendar day, repeating daily (not once-ever
--                             like the others).
-- 'first_message_of_day' needs its own once-PER-DAY claim table, separate
-- from automation_starts (which is once-per-contact-ever and shared by
-- tag_added/keyword/button_tap/any_message).
alter table automations drop constraint automations_trigger_type_check;
alter table automations add constraint automations_trigger_type_check
  check (trigger_type = any (array['tag_added', 'keyword', 'no_reply', 'button_tap', 'any_message', 'first_message_of_day']));

create table if not exists automation_daily_starts (
  automation_id uuid not null references automations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  started_on date not null,
  primary key (automation_id, contact_id, started_on)
);

alter table automation_daily_starts enable row level security;
-- Same helper automation_starts already uses for the exact same shape of policy.
create policy automation_daily_starts_all on automation_daily_starts
  using (is_workspace_member_via_automation(automation_id))
  with check (is_workspace_member_via_automation(automation_id));
