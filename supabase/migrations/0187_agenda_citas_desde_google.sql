-- Agenda (24 nov 2026): las citas creadas directamente en Google Calendar
-- (por ejemplo, las que agendan los clientes con la pagina de reservas de
-- Google) tambien aparecen en la Agenda del CRM.
--
-- Hasta ahora solo se sincronizaban las citas que creaba el CRM. Con el mismo
-- permiso ya aprobado por Google (calendar.events.owned) se listan los eventos
-- del calendario propio y se importan los que no son del CRM.
--
-- Una cita de Google puede no tener contacto en el CRM (quien reservo solo dejo
-- nombre y correo): contact_id pasa a ser opcional y se guarda el nombre de
-- quien reservo para mostrarlo.

alter table public.agenda_eventos alter column contact_id drop not null;
alter table public.agenda_eventos add column if not exists origen text not null default 'crm';
alter table public.agenda_eventos add column if not exists nombre_externo text;

-- Un evento de Google se importa una sola vez por conexion.
create unique index if not exists agenda_eventos_conexion_google_unico
  on public.agenda_eventos (conexion_id, google_event_id)
  where google_event_id is not null;

-- Contacto del espacio al que pertenece un correo: el de una cita anterior con
-- ese correo o, si es un cliente de Bybluee, el contacto ligado al espacio cuyo
-- dueno usa ese correo. Solo la llama el servidor.
create or replace function public.agenda_contacto_por_correo(p_workspace uuid, p_correo text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.contact_id
       from agenda_eventos e
      where e.workspace_id = p_workspace
        and e.contact_id is not null
        and (lower(e.invitado_email) = lower(p_correo)
             or exists (select 1 from unnest(e.invitados) i where lower(i) = lower(p_correo)))
      order by e.created_at desc
      limit 1),
    (select w.cliente_contact_id
       from auth.users u
       join workspace_members m on m.user_id = u.id and m.role = 'owner'
       join workspaces w on w.id = m.workspace_id
       join contacts c on c.id = w.cliente_contact_id and c.workspace_id = p_workspace
      where lower(u.email) = lower(p_correo)
      order by w.created_at desc
      limit 1)
  );
$$;

revoke all on function public.agenda_contacto_por_correo(uuid, text) from public, anon, authenticated;
grant execute on function public.agenda_contacto_por_correo(uuid, text) to service_role;
