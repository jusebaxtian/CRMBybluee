-- Fase 3 de Google Calendar: lo que se cambia en Google (hora, titulo, invitado o
-- cancelacion de una cita creada desde el CRM) vuelve a la Agenda.
--
-- Solo se leen los eventos que el CRM creo, uno por uno por su id: nunca se
-- recorre el calendario del usuario.
begin;

-- Canal por el que Google avisa que algo cambio. El secreto es solo del servidor
-- (la tabla solo concede lectura de columnas puntuales al navegador, y estas no estan).
alter table public.integraciones_conexiones
  add column canal_id text,
  add column canal_recurso_id text,
  add column canal_expira timestamptz,
  add column canal_secreto text;

create unique index integraciones_conexiones_canal_idx on public.integraciones_conexiones (canal_id) where canal_id is not null;

-- etag: la version del evento en Google (para no releer lo que no cambio).
-- cancelado_desde: quien la cancelo, para decirlo en la Agenda.
alter table public.agenda_eventos
  add column google_etag text,
  add column cancelado_desde text check (cancelado_desde in ('crm', 'google'));

commit;
