-- Recordatorios por contacto.
--
-- Desde el chat se programa "recordarme el X a las Y: Llamar cliente". Un
-- trabajo de fondo, al llegar la hora, deja el aviso en la campana del
-- espacio (titulo con el nombre del contacto, el texto y boton "Ir al chat")
-- y borra el recordatorio: no se guarda historial.

create table if not exists public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  texto text not null,
  recordar_en timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists recordatorios_recordar_en_idx on public.recordatorios (recordar_en);
create index if not exists recordatorios_conversation_idx on public.recordatorios (conversation_id);

alter table public.recordatorios enable row level security;

drop policy if exists recordatorios_miembros on public.recordatorios;
create policy recordatorios_miembros on public.recordatorios
  for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

select pg_notify('pgrst', 'reload schema');
