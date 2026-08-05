-- One AI sales agent per workspace, using the client's own API key
-- ("bring your own key") — never a key shared across workspaces.
create table ai_agents (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  provider text not null check (provider = any(array['openai', 'anthropic'])),
  api_key text not null,
  model text not null,
  agent_name text not null default 'Asistente',
  persona text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Set automatically when the AI itself decides to hand off (customer asked
-- for a human, or something outside what it should answer) — stops the AI
-- from replying to this conversation until an agent clears it.
alter table conversations add column ai_handoff_requested boolean not null default false;

alter table ai_agents enable row level security;

create policy "ai_agents_all" on ai_agents
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id));

insert into modules (key, name) values ('ai_agent', 'Agente de IA')
on conflict (key) do nothing;
