-- Fase 4 de Google Calendar: un recordatorio puede crearse tambien como evento
-- (con alarma) en el calendario de quien lo programa. Aqui se guarda el enlace
-- con ese evento para poder moverlo o borrarlo cuando el recordatorio cambie.
begin;

alter table public.recordatorios
  add column google_event_id text,
  add column conexion_id uuid references public.integraciones_conexiones (id) on delete set null;

commit;
