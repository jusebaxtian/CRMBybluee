-- workspace_unread_messages_count (used for the sidebar "Conversaciones"
-- badge) counted every unread inbound MESSAGE regardless of whether the
-- conversation had since been answered — so a chat you already replied to
-- kept inflating the badge with old unread messages from before your reply.
-- inbox_conversation_summaries() (used by the "No leídos" filter) already
-- has the correct rule: only count unread if the LAST message in the
-- conversation is still inbound. Rewritten to count CONVERSATIONS using
-- that same rule (same lateral-join shape as inbox_conversation_summaries),
-- so the badge and the filter agree.
create or replace function workspace_unread_messages_count(p_workspace_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from conversations c
  cross join lateral (
    select direction
    from messages m
    where m.conversation_id = c.id
    order by created_at desc
    limit 1
  ) lm
  where c.workspace_id = p_workspace_id
    and lm.direction = 'in'
    and exists (
      select 1 from messages m
      where m.conversation_id = c.id and m.direction = 'in'
        and (c.last_read_at is null or m.created_at > c.last_read_at)
    );
$$;
