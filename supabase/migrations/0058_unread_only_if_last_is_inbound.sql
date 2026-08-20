-- "No leídos" was counting any inbound message newer than last_read_at,
-- even when the agent had already replied afterward (last message is
-- "out") — so a conversation the agent had fully answered could still show
-- up as unread just because the human never physically opened that chat
-- page. Per explicit product decision: unread should only apply when the
-- customer's message is genuinely the latest thing in the conversation
-- and nobody has opened the chat since — i.e. last_direction = 'in'.
create or replace function inbox_conversation_summaries(p_workspace_id uuid)
returns table (
  conversation_id uuid,
  last_body text,
  last_message_type text,
  last_direction text,
  last_created_at timestamptz,
  last_inbound_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as conversation_id,
    lm.body as last_body,
    lm.message_type as last_message_type,
    lm.direction as last_direction,
    lm.created_at as last_created_at,
    li.created_at as last_inbound_at,
    case when lm.direction = 'in' then coalesce(uc.cnt, 0) else 0 end as unread_count
  from conversations c
  left join lateral (
    select body, message_type, direction, created_at
    from messages m
    where m.conversation_id = c.id
    order by created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select created_at
    from messages m
    where m.conversation_id = c.id and m.direction = 'in'
    order by created_at desc
    limit 1
  ) li on true
  left join lateral (
    select count(*) as cnt
    from messages m
    where m.conversation_id = c.id
      and m.direction = 'in'
      and (c.last_read_at is null or m.created_at > c.last_read_at)
  ) uc on true
  where c.workspace_id = p_workspace_id;
$$;
