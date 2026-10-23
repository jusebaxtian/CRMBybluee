-- Eventos de la Agenda (fase 2 de Google Calendar): citas y reuniones con un
-- contacto, que ademas se crean en el Google Calendar de quien las programa.
-- Aparte de los recordatorios (que solo avisan en la campana).
begin;

create table public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  titulo text not null check (char_length(titulo) between 1 and 200),
  descripcion text check (descripcion is null or char_length(descripcion) <= 2000),
  inicio timestamptz not null,
  fin timestamptz not null check (fin > inicio),
  invitado_email text,
  con_meet boolean not null default false,
  meet_url text,
  -- Id del evento en Google y la conexion (del usuario que lo creo) con la que se creo.
  google_event_id text,
  conexion_id uuid references public.integraciones_conexiones (id) on delete set null,
  estado text not null default 'confirmado' check (estado in ('confirmado', 'cancelado')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agenda_eventos_workspace_inicio_idx on public.agenda_eventos (workspace_id, inicio);
create index agenda_eventos_contacto_idx on public.agenda_eventos (contact_id);

alter table public.agenda_eventos enable row level security;

create policy agenda_eventos_miembros on public.agenda_eventos
  for all
  using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));

commit;
