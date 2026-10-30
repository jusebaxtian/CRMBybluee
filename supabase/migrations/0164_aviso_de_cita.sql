-- Aviso de cita: poco antes de que empiece una cita de la Agenda, quien la
-- programo recibe una notificacion al celular (push) y en la campana, con el
-- boton para entrar directo a la reunion de Meet. Se avisa UNA sola vez:
-- `aviso_enviado_el` lo marca. Si la cita se mueve a otra hora (desde el CRM
-- o desde Google Calendar), un disparador lo limpia para avisar a la hora nueva.

alter table public.agenda_eventos add column if not exists aviso_enviado_el timestamptz;

-- Las citas existentes que ya pasaron no se avisan al desplegar.
update public.agenda_eventos set aviso_enviado_el = now() where inicio < now() and aviso_enviado_el is null;

create index if not exists agenda_eventos_aviso_pendiente
  on public.agenda_eventos (inicio)
  where aviso_enviado_el is null and estado = 'confirmado';

create or replace function public.agenda_eventos_reprogramar_aviso()
returns trigger
language plpgsql
as $$
begin
  if new.inicio is distinct from old.inicio and new.inicio > now() then
    new.aviso_enviado_el := null;
  end if;
  return new;
end;
$$;

drop trigger if exists agenda_eventos_reprogramar_aviso on public.agenda_eventos;
create trigger agenda_eventos_reprogramar_aviso
  before update of inicio on public.agenda_eventos
  for each row execute function public.agenda_eventos_reprogramar_aviso();

select pg_notify('pgrst', 'reload schema');
