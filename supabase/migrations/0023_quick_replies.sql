-- Quick replies: pre-built flows (same action types as automations — text,
-- media, template, add tag) that an agent triggers manually with one click
-- from inside a conversation, instead of being triggered by a tag/keyword.

insert into modules (key, name, description) values
  ('quick_replies', 'Respuestas rápidas', 'Flujos predefinidos que se envían con un clic desde el chat')
on conflict (key) do nothing;

insert into plan_modules (plan_id, module_key)
select p.id, 'quick_replies' from plans p
where not exists (
  select 1 from plan_modules pm where pm.plan_id = p.id and pm.module_key = 'quick_replies'
);

create table quick_replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table quick_reply_actions (
  id uuid primary key default gen_random_uuid(),
  quick_reply_id uuid not null references quick_replies (id) on delete cascade,
  position int not null,
  action_type text not null check (action_type in (
    'send_message', 'add_tag', 'send_image', 'send_video', 'send_audio',
    'send_document', 'send_template'
  )),
  message_body text,
  tag_id uuid references tags (id) on delete set null,
  media_url text,
  media_filename text,
  template_id uuid references templates (id) on delete set null
);

alter table quick_replies enable row level security;
alter table quick_reply_actions enable row level security;

create policy "quick_replies_all" on quick_replies
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

create or replace function is_workspace_member_via_quick_reply(target_quick_reply_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from quick_replies qr
    where qr.id = target_quick_reply_id
      and (is_workspace_member(qr.workspace_id) or is_platform_admin())
  );
$$;

create policy "quick_reply_actions_all" on quick_reply_actions
  for all using (is_workspace_member_via_quick_reply(quick_reply_id))
  with check (is_workspace_member_via_quick_reply(quick_reply_id));
