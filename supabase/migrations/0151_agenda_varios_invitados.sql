-- Una cita puede invitar a varias personas. `invitado_email` (el primero) se sigue
-- guardando: lo usan el autocompletado por contacto y la sincronizacion con Google.
-- Aditivo y con valor por defecto: las citas existentes siguen funcionando igual.
begin;

alter table public.agenda_eventos add column invitados text[] not null default '{}';

update public.agenda_eventos
set invitados = array[invitado_email]
where invitado_email is not null and invitados = '{}';

commit;
