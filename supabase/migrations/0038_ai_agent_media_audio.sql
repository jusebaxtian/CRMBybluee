alter table ai_agent_media drop constraint ai_agent_media_media_type_check;
alter table ai_agent_media add constraint ai_agent_media_media_type_check
  check (media_type = any(array['image', 'video', 'audio', 'document']));
