-- Tracks every WhatsApp "business-initiated" conversation Meta opens (per
-- their pricing/conversation model) so we can show usage against the
-- account's daily messaging limit tier (e.g. TIER_250 = 250/day). Meta
-- reports the same conversation.id on every status update (sent/delivered/
-- read) for messages inside that conversation, so meta_conversation_id is
-- unique — we insert once, on the first status update we see it on.
create table conversation_opens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  meta_conversation_id text not null unique,
  origin_type text not null,
  opened_at timestamptz not null default now()
);

create index conversation_opens_workspace_opened_idx
  on conversation_opens (workspace_id, opened_at);

alter table conversation_opens enable row level security;

create policy "conversation_opens_select" on conversation_opens
  for select using (is_workspace_member(workspace_id) or is_platform_admin());
