-- Integraciones (fase 1 de Google Calendar): el modulo por plan y la tabla donde
-- queda la conexion de cada usuario.
--
-- El token de Google se guarda CIFRADO (AES-256-GCM, llave del servidor) y la
-- columna ni siquiera se puede leer desde el navegador: solo el servidor la lee.
-- Cada usuario ve unicamente su propia conexion; ni siquiera el administrador de
-- la plataforma en modo soporte ve la de un cliente.
begin;

insert into modules (key, name, description) values
  ('google_calendar', 'Google Calendar', 'Conecta tu calendario de Google y sincroniza las citas de la Agenda, con link de Meet')
on conflict (key) do nothing;

create table public.integraciones_conexiones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  proveedor text not null check (proveedor in ('google_calendar')),
  cuenta_email text,
  token_cifrado text not null,
  alcances text,
  estado text not null default 'conectado' check (estado in ('conectado', 'requiere_reconexion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, proveedor)
);

create index integraciones_conexiones_workspace_idx on public.integraciones_conexiones (workspace_id);

alter table public.integraciones_conexiones enable row level security;

-- Solo la propia persona, y sin la columna del token.
create policy integraciones_conexiones_propia on public.integraciones_conexiones
  for select
  using (user_id = (select auth.uid()));

revoke all on public.integraciones_conexiones from anon, authenticated;
grant select (id, workspace_id, user_id, proveedor, cuenta_email, alcances, estado, created_at, updated_at)
  on public.integraciones_conexiones to authenticated;

commit;
