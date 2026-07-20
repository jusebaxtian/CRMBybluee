-- Extend automation actions to support sending media (image/video/audio/document)
-- and approved templates (which can open a conversation even outside the 24h
-- customer-service window), not just plain text messages and tag assignment.

alter table automation_actions drop constraint automation_actions_action_type_check;
alter table automation_actions add constraint automation_actions_action_type_check
  check (action_type in (
    'send_message', 'add_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template'
  ));

alter table automation_actions add column media_url text;
alter table automation_actions add column media_filename text;
alter table automation_actions add column template_id uuid references templates (id) on delete set null;
