-- Ajustes de la Agenda por espacio: la linea de WhatsApp por la que salen los
-- mensajes de las citas (confirmacion y, mas adelante, recordatorios al
-- cliente). Sin esto, con varias lineas el mensaje salia por la del ultimo chat
-- del contacto, que no siempre es la que el negocio quiere usar.
-- Sin fila, o con la linea en null, se mantiene el comportamiento de siempre.
begin;

create table public.agenda_ajustes (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  whatsapp_account_id uuid references public.whatsapp_accounts (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.agenda_ajustes enable row level security;

create policy agenda_ajustes_leer on public.agenda_ajustes
  for select
  using (is_workspace_member(workspace_id));

-- Solo el dueño y los administradores del espacio la cambian.
create policy agenda_ajustes_escribir on public.agenda_ajustes
  for all
  using ((select is_platform_admin()) or workspace_role(workspace_id) in ('owner', 'admin'))
  with check ((select is_platform_admin()) or workspace_role(workspace_id) in ('owner', 'admin'));

commit;
