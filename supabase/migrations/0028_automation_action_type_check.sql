-- automation_actions_action_type_check predates send_quick_reply and was
-- silently rejecting every insert containing it (the app code didn't check
-- the insert's error result, so the automation record saved with zero
-- actions and no visible error).
alter table automation_actions drop constraint automation_actions_action_type_check;
alter table automation_actions add constraint automation_actions_action_type_check
  check (action_type = any (array[
    'send_message', 'add_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template', 'send_quick_reply', 'assign_agent',
    'assign_agent_random'
  ]));
