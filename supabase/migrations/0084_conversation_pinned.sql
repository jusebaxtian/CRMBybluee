-- Permite fijar hasta 3 conversaciones arriba de la bandeja. El fijado es
-- compartido por todo el espacio de trabajo: si el dueño fija un chat, sus
-- agentes también lo ven arriba.
--
-- Se guarda la marca de tiempo y no un booleano para poder ordenar entre los
-- fijados: el último que se fijó queda de primero.
alter table conversations
  add column pinned_at timestamptz;

-- La bandeja ordena por pinned_at antes que por last_message_at, así que
-- conviene tenerlo indexado junto al workspace. Índice parcial: solo las
-- fijadas (a lo sumo 3 por espacio) entran, el resto no ocupa.
create index conversations_pinned_idx
  on conversations (workspace_id, pinned_at desc)
  where pinned_at is not null;

select pg_notify('pgrst', 'reload schema');
