-- Root cause of "0 contactos" in the campaign audience preview: when a tag
-- matches many contacts (e.g. 141), resolveCampaignAudience built a giant
-- `?id=in.(uuid,uuid,...)` GET query string (5000+ chars) to fetch/filter
-- contacts and, separately, conversations for the open-window check.
-- Confirmed live: that request returns a 502 from nginx (URL/header size
-- limit) — a failed PostgREST call resolves to `data: null`, which the code
-- silently treated as an empty result, i.e. 0 contacts, for every filter
-- past that point. Not a data problem — a URL-length ceiling.
--
-- Fix: resolve the whole audience in one RPC call. Supabase RPC calls are
-- POST requests with a JSON body, so array parameters never touch the URL
-- no matter how many ids they contain — this scales indefinitely instead
-- of breaking again once tags have Nnn+ contacts.
create or replace function resolve_campaign_recipients(
  p_workspace_id uuid,
  p_include_tag_ids uuid[] default null,
  p_exclude_tag_ids uuid[] default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null
)
returns table (contact_id uuid, has_open_window boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as contact_id,
    coalesce(li.created_at > now() - interval '24 hours', false) as has_open_window
  from contacts c
  left join conversations conv on conv.contact_id = c.id and conv.workspace_id = p_workspace_id
  left join lateral (
    select created_at from messages m
    where m.conversation_id = conv.id and m.direction = 'in'
    order by created_at desc
    limit 1
  ) li on true
  where c.workspace_id = p_workspace_id
    and c.likely_blocked = false
    and (p_created_from is null or c.created_at >= p_created_from)
    and (p_created_to is null or c.created_at <= p_created_to)
    and (
      p_include_tag_ids is null or array_length(p_include_tag_ids, 1) is null
      or exists (
        select 1 from contact_tags ct
        where ct.contact_id = c.id and ct.tag_id = any(p_include_tag_ids)
      )
    )
    and not exists (
      select 1 from contact_tags ct
      join tags t on t.id = ct.tag_id
      where ct.contact_id = c.id
        and (
          (p_exclude_tag_ids is not null and ct.tag_id = any(p_exclude_tag_ids))
          or t.excludes_followups = true
        )
    );
$$;

-- Same URL-length risk existed in executeCampaignSend's "no seguimientos"
-- last-line guard (an IN-list of every recipient's contact_id). Resolved
-- via campaign_id join instead of passing ids at all.
create or replace function campaign_no_followup_recipient_ids(p_campaign_id uuid)
returns table (contact_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct cr.contact_id
  from campaign_recipients cr
  join contact_tags ct on ct.contact_id = cr.contact_id
  join tags t on t.id = ct.tag_id
  where cr.campaign_id = p_campaign_id and t.excludes_followups = true;
$$;
