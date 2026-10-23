-- Plan de fidelidad: registro de los mensajes que la plataforma le manda a sus
-- propios clientes segun el ciclo de su plan (bienvenida, avisos de
-- vencimiento, recuperacion y ultimo aviso).
--
-- Cada fila es un envio: que cliente, que etapa, de que periodo. La restriccion
-- unica es lo que garantiza "una vez por cliente y periodo": el trabajo
-- reserva la fila ANTES de enviar, asi que dos procesos que corran a la vez no
-- pueden mandar el mismo mensaje dos veces.
--
-- "modo" separa las pruebas (que llegan solo al telefono del administrador) de
-- los envios reales: probar no gasta el mensaje del cliente.
create table if not exists public.fidelidad_envios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  workspace_nombre text,
  etapa text not null,
  -- Fecha de vencimiento del plan a la que pertenece el aviso (hora de Bogota).
  -- Si el cliente renueva, el periodo cambia y el ciclo empieza de nuevo.
  periodo date not null,
  modo text not null check (modo in ('real', 'prueba')),
  estado text not null check (estado in ('enviando', 'enviado', 'fallido')),
  wa_message_id text,
  error text,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

create unique index if not exists fidelidad_envios_una_vez
  on public.fidelidad_envios (workspace_id, etapa, periodo, modo)
  where estado in ('enviando', 'enviado');

create index if not exists fidelidad_envios_reciente
  on public.fidelidad_envios (creado_el desc);

alter table public.fidelidad_envios enable row level security;

-- Solo el administrador de la plataforma lo ve. Escribe el servidor con la
-- llave de servicio, que no pasa por las politicas.
drop policy if exists fidelidad_envios_admin_select on public.fidelidad_envios;
create policy fidelidad_envios_admin_select on public.fidelidad_envios
  for select using ((select public.is_platform_admin()));

select pg_notify('pgrst', 'reload schema');
