-- Acción "Quitar etiqueta" en automatizaciones, seguimientos y respuestas rápidas.
--
-- Hasta ahora solo existia "Agregar etiqueta". Los flujos ya tenian el bloque
-- "Quitar etiqueta" y lo guardaban como `remove_tag`, pero el motor no sabia
-- ejecutarlo: lo dejaba pasar sin hacer nada. Aqui solo se amplia la lista de
-- tipos permitidos; el motor se corrige en el codigo.
--
--   automation_actions   (automatizaciones y seguimientos comparten tabla)
--   quick_reply_actions  (respuestas rapidas)
begin;

alter table public.automation_actions
  drop constraint if exists automation_actions_action_type_check,
  add constraint automation_actions_action_type_check check (action_type in (
    'send_message', 'add_tag', 'remove_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template', 'send_quick_reply', 'assign_agent',
    'assign_agent_random', 'wait_for_reply'
  ));

alter table public.quick_reply_actions
  drop constraint if exists quick_reply_actions_action_type_check,
  add constraint quick_reply_actions_action_type_check check (action_type in (
    'send_message', 'add_tag', 'remove_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template'
  ));

commit;
