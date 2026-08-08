-- Templates can now have a media header (image/video/document) instead of
-- just plain text — WhatsApp itself does not support audio as a template
-- header format, only IMAGE/VIDEO/DOCUMENT/TEXT/LOCATION.
alter table templates add column header_format text
  check (header_format = any(array['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']));
alter table templates add column header_text text;
alter table templates add column header_media_url text;
alter table templates add column header_media_mime_type text;
