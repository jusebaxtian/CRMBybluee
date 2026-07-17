-- Templates (synced from Meta), campaigns and per-recipient send tracking.

create table templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  meta_template_name text not null,
  language text not null default 'es',
  category text,
  status text not null default 'PENDING',
  body_text text,
  variable_count int not null default 0,
  synced_at timestamptz not null default now(),
  unique (workspace_id, meta_template_name, language)
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  template_id uuid references templates (id),
  audience_tag_id uuid references tags (id), -- null = all contacts
  status text not null default 'draft' check (status in ('draft', 'sending', 'completed', 'failed')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create table campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  contact_id uuid not null references contacts (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message text,
  sent_at timestamptz,
  unique (campaign_id, contact_id)
);

create or replace function is_workspace_member_via_campaign(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from campaigns c
    where c.id = target_campaign_id
      and (is_workspace_member(c.workspace_id) or is_platform_admin())
  );
$$;

alter table templates enable row level security;
alter table campaigns enable row level security;
alter table campaign_recipients enable row level security;

create policy "templates_all" on templates
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

create policy "campaigns_all" on campaigns
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

create policy "campaign_recipients_select" on campaign_recipients
  for select using (is_workspace_member_via_campaign(campaign_id));

create policy "campaign_recipients_insert" on campaign_recipients
  for insert with check (is_workspace_member_via_campaign(campaign_id));

create policy "campaign_recipients_update" on campaign_recipients
  for update using (is_workspace_member_via_campaign(campaign_id));
