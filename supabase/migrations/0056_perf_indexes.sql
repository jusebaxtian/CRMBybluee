-- messages.wa_message_id is looked up on every single WhatsApp delivery
-- status webhook (sent/delivered/read/failed — up to 3-4 per message) and
-- had no index at all, forcing a sequential scan of the whole table on
-- every one (confirmed via EXPLAIN in production). As message volume grows
-- this only gets worse — this is very likely the main "app feels slow"
-- driver since webhook processing runs on every send/status change.
create index messages_wa_message_id_idx on messages (wa_message_id);

-- contact_tags is keyed (contact_id, tag_id), so a lookup by tag_id alone
-- (used by campaign audience include/exclude filters — see
-- resolveCampaignAudience) can't use that index. Small table today, but
-- free to add and only grows more relevant as tags/campaigns are used more.
create index contact_tags_tag_id_idx on contact_tags (tag_id);
