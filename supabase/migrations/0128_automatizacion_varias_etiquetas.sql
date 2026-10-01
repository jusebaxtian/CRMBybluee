-- Una automatización por etiqueta puede escuchar VARIAS etiquetas.
--
-- Hasta ahora era una sola (`trigger_tag_id`), así que para "arranca con
-- Interesado o con Cotización" había que duplicar la automatización entera y
-- mantener las dos a mano. La segunda copia siempre se queda sin actualizar.
--
-- Se guarda como arreglo y no en una tabla aparte porque son dos o tres
-- etiquetas por automatización, siempre se leen juntas y nunca se consultan
-- al revés. Una tabla de relación aquí sería más código para la misma
-- respuesta.
--
-- `trigger_tag_id` se mantiene y se sigue escribiendo con la primera del
-- arreglo: hay pantallas que lo leen para mostrar el nombre de la etiqueta, y
-- romperlas no aporta nada.
alter table public.automations
  add column if not exists trigger_tag_ids uuid[];

comment on column public.automations.trigger_tag_ids is
  'Etiquetas que disparan la automatización. Cualquiera de ellas la activa. trigger_tag_id guarda la primera por compatibilidad.';

-- Las que ya existen pasan a tener su única etiqueta dentro del arreglo, para
-- que el motor pueda leer siempre el mismo campo.
update public.automations
set trigger_tag_ids = array[trigger_tag_id]
where trigger_type = 'tag_added'
  and trigger_tag_id is not null
  and trigger_tag_ids is null;

-- El motor pregunta "¿alguna automatización escucha esta etiqueta?" en cada
-- etiquetado: con índice GIN eso es una búsqueda en el arreglo y no un
-- recorrido de la tabla.
create index if not exists automations_trigger_tag_ids_idx
  on public.automations using gin (trigger_tag_ids);

select pg_notify('pgrst', 'reload schema');
