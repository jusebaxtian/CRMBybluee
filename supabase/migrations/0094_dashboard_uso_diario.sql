-- Uso del limite diario de Meta, por numero.
--
-- La tabla conversation_opens, que alimentaba este dato, esta vacia en todo
-- el sistema: cero filas desde siempre. Solo se escribia cuando el webhook de
-- estado traia conversation.origin.type = 'business_initiated', y desde el
-- cambio de Meta a precio por mensaje (2025) ese campo no llega asi. El
-- dashboard mostraba "0 / 250" a todos los clientes y nadie lo noto.
--
-- El limite de Meta cuenta usuarios distintos a los que el negocio INICIO
-- conversacion en una ventana movil de 24 h, es decir, a quienes se les
-- mando una plantilla. Eso si esta en messages (message_type = 'template',
-- direction = 'out'), y la conversacion sabe por que numero salio.
--
-- Verificado el 12 sep 2026 contra un numero real: la tabla decia 0 y esto
-- devuelve 42, con 103 conversaciones activas ese dia.
create or replace function dashboard_uso_diario(p_workspace_id uuid)
returns table (whatsapp_account_id uuid, contactos bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.whatsapp_account_id, count(distinct c.contact_id)
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.workspace_id = p_workspace_id
    and is_workspace_member(p_workspace_id)
    and m.direction = 'out'
    and m.message_type = 'template'
    and m.created_at > now() - interval '24 hours'
  group by c.whatsapp_account_id;
$$;

select pg_notify('pgrst', 'reload schema');
