-- Media attachments for chat messages (images, documents, audio/voice notes).

alter table messages add column media_url text;
alter table messages add column media_mime_type text;

-- Public bucket: WhatsApp's Cloud API needs a publicly reachable link to send
-- outbound media, and we also re-host inbound media here (Meta's own media
-- URLs are short-lived and require the account's access token).
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;
