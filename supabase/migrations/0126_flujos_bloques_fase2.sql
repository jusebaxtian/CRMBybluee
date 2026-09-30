-- Los bloques de la fase 2: plantilla, condicion, etiqueta, agente,
-- respuesta rapida, disparar automatizacion y saltar a otro flujo.
--
-- La restriccion de `tipo` nombra uno por uno los bloques que existen a
-- proposito: si mañana el lienzo guarda un tipo que el motor no sabe
-- ejecutar, es mejor que la base lo rechace en ese momento y no que el
-- contacto se quede parado a mitad de un flujo sin que nadie se entere.
alter table public.flujo_nodos drop constraint if exists flujo_nodos_tipo_check;

alter table public.flujo_nodos add constraint flujo_nodos_tipo_check
  check (tipo in (
    'inicio',
    'mensaje',
    'plantilla',
    'botones',
    'esperar',
    'condicion',
    'etiqueta',
    'agente',
    'respuesta_rapida',
    'automatizacion',
    'saltar',
    'ia',
    'fin'
  ));

select pg_notify('pgrst', 'reload schema');
