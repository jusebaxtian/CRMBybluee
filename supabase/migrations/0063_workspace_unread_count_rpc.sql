-- dashboard/layout.tsx (runs on every navigation) was fetching every
-- conversation id for the workspace client-side, then issuing
-- `messages?conversation_id=in.(uuid,uuid,...)` — for a workspace with
-- hundreds of conversations this query string blows past nginx's proxy
-- header size limit ("upstream sent too big header"), causing a 502 and a
-- slow client-side retry/fallback on literally every click in the CRM.
-- Same root cause as the earlier campaign-audience 502 bug — fixed the same
-- way, by moving the lookup into a single RPC call with no URL-length
-- ceiling.
create or replace function workspace_unread_messages_count(p_workspace_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.workspace_id = p_workspace_id
    and m.direction = 'in'
    and (c.last_read_at is null or m.created_at > c.last_read_at);
$$;
