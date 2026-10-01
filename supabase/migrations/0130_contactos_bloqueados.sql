-- Contactos bloqueados: WhatsApp deja de entregarnos sus mensajes.
--
-- El bloqueo vive en Meta, no aquí; esta columna es el reflejo, y hace falta
-- por tres cosas que la API no da: mostrarlo en la lista de contactos sin
-- preguntarle a Meta en cada carga, dejarlos fuera de campañas y
-- automatizaciones, y saber desde cuándo.
--
-- No confundir con `likely_blocked`, que es lo contrario: la sospecha de que
-- el contacto nos bloqueó a nosotros, deducida de los fallos de entrega.
alter table public.contacts
  add column if not exists bloqueado_el timestamptz;

comment on column public.contacts.bloqueado_el is
  'Cuándo se bloqueó a este contacto en Meta. Null = no está bloqueado.';

-- Parcial: los bloqueados son pocos y es la única consulta que importa.
create index if not exists contacts_bloqueados_idx
  on public.contacts (workspace_id, bloqueado_el)
  where bloqueado_el is not null;

select pg_notify('pgrst', 'reload schema');
