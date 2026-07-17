-- Contacts, tags, conversations and messages for the inbox module.

create table contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  wa_id text not null, -- WhatsApp phone number, digits only (Meta's user id format)
  name text,
  created_at timestamptz not null default now(),
  unique (workspace_id, wa_id)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  color text not null default '#7c5cff',
  unique (workspace_id, name)
);

create table contact_tags (
  contact_id uuid not null references contacts (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (contact_id, tag_id)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz not null default now(),
  unique (workspace_id, contact_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  message_type text not null default 'text',
  body text,
  wa_message_id text,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'read', 'failed')),
  sent_by_support boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on messages (conversation_id, created_at);

create or replace function is_workspace_member_via_conversation(target_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from conversations c
    where c.id = target_conversation_id
      and (is_workspace_member(c.workspace_id) or is_platform_admin())
  );
$$;

alter table contacts enable row level security;
alter table tags enable row level security;
alter table contact_tags enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "contacts_all" on contacts
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

create policy "tags_all" on tags
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

create policy "contact_tags_all" on contact_tags
  for all using (
    exists (select 1 from contacts c where c.id = contact_id and (is_workspace_member(c.workspace_id) or is_platform_admin()))
  )
  with check (
    exists (select 1 from contacts c where c.id = contact_id and is_workspace_member(c.workspace_id))
  );

create policy "conversations_all" on conversations
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

create policy "messages_select" on messages
  for select using (is_workspace_member_via_conversation(conversation_id));

create policy "messages_insert" on messages
  for insert with check (is_workspace_member_via_conversation(conversation_id));

create policy "messages_update" on messages
  for update using (is_workspace_member_via_conversation(conversation_id));
