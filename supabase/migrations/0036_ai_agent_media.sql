-- Media library the AI sales agent can attach to its own replies (a payment
-- QR, a demo video, a catalog PDF...). The AI decides when to use each one
-- based on "trigger_description" — see buildSystemPrompt in lib/ai/agent.ts.
create table ai_agent_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  key text not null,
  label text not null,
  trigger_description text not null,
  media_type text not null check (media_type = any(array['image', 'video', 'document'])),
  media_url text not null,
  media_mime_type text not null,
  filename text,
  created_at timestamptz not null default now(),
  unique (workspace_id, key)
);

alter table ai_agent_media enable row level security;

create policy "ai_agent_media_all" on ai_agent_media
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));
