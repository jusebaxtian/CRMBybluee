-- La lista de campañas mostraba created_at, que es cuándo se creó el borrador
-- y no dice nada útil una vez la campaña se envió: una campaña creada el lunes
-- y enviada el viernes se veía con fecha de lunes.
--
-- started_at guarda el momento en que la campaña empezó a enviarse de verdad
-- (cuando pasa a estado "sending"), venga de un envío manual o del programador.
alter table campaigns
  add column started_at timestamptz;

-- Recupera el histórico: campaign_recipients.sent_at ya registra cuándo salió
-- cada mensaje, así que el primero de ellos es el inicio real del envío. Sin
-- esto las campañas ya enviadas se quedarían sin fecha.
update campaigns c
set started_at = sub.first_sent
from (
  select campaign_id, min(sent_at) as first_sent
  from campaign_recipients
  where sent_at is not null
  group by campaign_id
) sub
where sub.campaign_id = c.id
  and c.started_at is null;

select pg_notify('pgrst', 'reload schema');
