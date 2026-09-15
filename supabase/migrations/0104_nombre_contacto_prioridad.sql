-- De donde salio el nombre del contacto, para que WhatsApp no pise el que
-- puso el cliente.
--
-- Regla (decision del 15 sep 2026): el nombre de perfil de WhatsApp se usa
-- solo la primera vez (o mientras el contacto no tenga nombre). Si el cliente
-- lo edita en el CRM o lo sube por Excel, ese nombre manda siempre: es el que
-- se usa en campañas, automatizaciones y plantillas ({{nombre}} / {{1}}).
--
-- Filas existentes: las que ya tienen nombre se marcan como 'manual' para
-- protegerlas (no hay forma de saber cuales edito el cliente); las que no
-- tienen nombre siguen recibiendo el de WhatsApp.
alter table contacts
  add column if not exists name_source text not null default 'whatsapp'
  check (name_source in ('whatsapp', 'manual', 'import'));

update contacts set name_source = 'manual' where name is not null and name <> '';

select pg_notify('pgrst', 'reload schema');
