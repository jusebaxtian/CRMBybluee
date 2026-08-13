-- The inbox list used to fetch every recent message across the whole
-- workspace (ordered globally, capped at PostgREST's 1000-row default) and
-- group it into per-conversation summaries in JS. Once a workspace passed
-- ~1000 total messages, any conversation whose latest message fell outside
-- that global top-1000 window got silently dropped from the map and showed
-- "Sin mensajes" even though it had messages — just not recent ones
-- relative to the rest of the workspace's volume.
--
-- This computes the same three things (last message, last inbound time,
-- unread count) per conversation directly in the DB via lateral joins, so
-- it scales with conversation count instead of total message count.
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
    coalesce(uc.cnt, 0) as unread_count
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
