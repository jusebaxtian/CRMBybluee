-- User asked: when sending a mass campaign, don't interrupt a contact an
-- agent is actively talking to right now (could be several agents, several
-- chats, at once). "Active right now" = a human agent (not automation, not
-- the AI agent) sent a message in that conversation within the last 15
-- minutes — messages.sent_by_support already existed for exactly this but
-- was never actually written by any send path until now (see the
-- companion code change wiring it up in the chat composer).
--
-- Same shape as campaign_no_followup_recipient_ids: resolved via a
-- campaign_id-scoped RPC (not a `?contact_id=in.(...)` list) to avoid
-- tripping nginx's URL-length limit on large recipient lists.
create or replace function campaign_active_chat_recipient_ids(p_campaign_id uuid, p_minutes integer default 15)
returns table(contact_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct cr.contact_id
  from campaign_recipients cr
  join conversations conv on conv.contact_id = cr.contact_id
  join messages m on m.conversation_id = conv.id
  where cr.campaign_id = p_campaign_id
    and m.sent_by_support = true
    and m.created_at > now() - (p_minutes || ' minutes')::interval;
$$;
