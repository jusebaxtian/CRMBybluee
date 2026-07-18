-- Tracks when a conversation was last opened/read, so the inbox can show a
-- WhatsApp-style unread bubble per conversation and clear it on open.

alter table conversations add column last_read_at timestamptz;
