-- Una campaña reclamada pasa a estado "sending", y el planificador solo
-- recoge las que están en "draft". Si el proceso muere a mitad del envío
-- —un reinicio de pm2, el límite de memoria, un despliegue— la campaña queda
-- en "sending" para siempre y sus destinatarios pendientes nunca salen.
--
-- Para reanudarla hace falta distinguir "muerta" de "lenta pero viva". Si se
-- reanudara una que sigue trabajando, habría dos bucles enviando a los mismos
-- destinatarios pendientes: mensajes duplicados, con costo real por cada uno.
--
-- last_progress_at es ese latido: el bucle de envío lo actualiza mientras
-- avanza. Si lleva rato sin moverse, el bucle ya no existe.
alter table campaigns
  add column last_progress_at timestamptz;

-- El planificador busca campañas en "sending" ordenadas por este campo, y son
-- pocas a la vez; el índice parcial mantiene el costo en nada.
create index campaigns_stalled_idx
  on campaigns (last_progress_at)
  where status = 'sending';

-- Las campañas que ya están enviando ahora mismo no tienen latido todavía.
-- Se les siembra con started_at para que no se las considere estancadas de
-- inmediato al desplegar este cambio.
update campaigns
set last_progress_at = coalesce(started_at, now())
where status = 'sending';

select pg_notify('pgrst', 'reload schema');
