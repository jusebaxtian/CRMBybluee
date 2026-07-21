-- Random-weighted agent assignment: an automation action that distributes
-- conversations across a set of agents by percentage instead of always
-- picking the same one.

alter table automation_actions
  add column agent_distribution jsonb;

alter table automation_actions drop constraint automation_actions_action_type_check;
alter table automation_actions add constraint automation_actions_action_type_check
  check (action_type in (
    'send_message', 'add_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template', 'assign_agent', 'assign_agent_random'
  ));
