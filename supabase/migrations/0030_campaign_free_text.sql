-- Lets a campaign send a free-form message (text/media, no template)
-- instead of always requiring an approved template — only valid within
-- WhatsApp's 24h customer-service window, hence the audience_window filter.
alter table campaigns add column send_type text not null default 'template'
  check (send_type = any(array['template', 'free_text']));
alter table campaigns add column message_body text;
alter table campaigns add column media_url text;
alter table campaigns add column media_filename text;
alter table campaigns alter column template_id drop not null;

-- 'open' restricts the audience to contacts whose 24h window is currently
-- open (i.e. they messaged in the last 24h) — required for free_text sends,
-- optional for template sends.
alter table campaigns add column audience_window text not null default 'all'
  check (audience_window = any(array['all', 'open']));
