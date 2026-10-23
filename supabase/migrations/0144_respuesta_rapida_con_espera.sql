-- Las respuestas rapidas guardan una espera por mensaje ("Esperar 5 minutos"),
-- pero al enviarlas desde el chat --y desde una automatizacion-- el motor las
-- ignoraba y todo salia en el mismo segundo. Esta tabla guarda el resto de la
-- respuesta para el momento en que le toca; un trabajo de fondo la retoma.
begin;

create table public.respuesta_rapida_pendientes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  quick_reply_id uuid not null references public.quick_replies (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  next_position int not null,
  run_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index respuesta_rapida_pendientes_run_at_idx on public.respuesta_rapida_pendientes (run_at);

alter table public.respuesta_rapida_pendientes enable row level security;

create policy "respuesta_rapida_pendientes_all" on public.respuesta_rapida_pendientes
  for all
  using (is_workspace_member(workspace_id) or (select is_platform_admin()))
  with check (is_workspace_member(workspace_id) or (select is_platform_admin()));

commit;
