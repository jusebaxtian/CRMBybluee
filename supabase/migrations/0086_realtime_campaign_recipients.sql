-- La pantalla de progreso de una campana se suscribe a campaign_recipients
-- (src/app/dashboard/campaigns/[id]/page.tsx, filtro campaign_id=eq.<id>),
-- pero la tabla nunca estuvo en la publicacion de realtime. El canal se unia
-- sin error y ningun cambio llegaba: la pantalla se quedaba congelada durante
-- todo el envio y habia que recargar a mano para ver el avance.
alter publication supabase_realtime add table campaign_recipients;

-- Se deja la replica identity por defecto (solo la clave primaria) a
-- proposito. Con "full" cada UPDATE escribiria la fila vieja completa en el
-- WAL, y un envio masivo actualiza miles de filas una por una. El filtro es
-- por campaign_id, que viaja en la fila nueva, asi que el valor por defecto
-- alcanza -- es lo mismo que hace messages, que filtra por conversation_id.
