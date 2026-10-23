-- Texto que acompaña a un documento enviado desde el chat.
--
-- En una imagen o un video el texto va en `body` (asi lo muestran la burbuja, la
-- lista de conversaciones y el reenvio, y asi llegan los de los clientes). En un
-- documento `body` ya guarda el NOMBRE DEL ARCHIVO, que la burbuja usa como
-- titulo y como nombre de descarga: meter ahi el texto rompia las dos cosas.
-- Por eso el texto de un documento va en su propia columna.
alter table public.messages
  add column if not exists caption text;

comment on column public.messages.caption is
  'Texto que acompaña a un documento enviado (en imagen y video el texto va en body).';

select pg_notify('pgrst', 'reload schema');
