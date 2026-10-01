-- Tiempo de espera entre los mensajes de una respuesta rápida.
--
-- Las automatizaciones y los seguimientos ya lo tenían; las respuestas
-- rápidas no, y por eso sus mensajes salían todos de golpe en el mismo
-- segundo. Tres mensajes seguidos sin respiro se leen como un robot, y es lo
-- que WhatsApp mira cuando decide si un número hace spam.
alter table public.quick_reply_actions
  add column if not exists delay_seconds integer not null default 0;

comment on column public.quick_reply_actions.delay_seconds is
  'Segundos a esperar ANTES de ejecutar esta acción. 0 = de inmediato.';

select pg_notify('pgrst', 'reload schema');
