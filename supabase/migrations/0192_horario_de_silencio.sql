-- Horario de silencio por espacio (26 nov 2026). Ver src/lib/silencio.ts.
-- Apagado por defecto: ninguna cuenta cambia hasta que lo active.

alter table public.workspaces
  add column if not exists silencio_activo boolean not null default false,
  add column if not exists silencio_inicio text not null default '22:00',
  add column if not exists silencio_fin text not null default '05:00';

alter table public.workspaces drop constraint if exists workspaces_silencio_horas_check;
alter table public.workspaces add constraint workspaces_silencio_horas_check
  check (silencio_inicio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and silencio_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Paso de automatizacion movido al final del silencio: al retomarse, si es texto
-- y la ventana de 24 h ya se cerro, no se envia.
alter table public.automation_pending_runs
  add column if not exists pospuesta_por_silencio boolean not null default false;
