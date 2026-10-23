-- Notificaciones que no deben llegar a las cuentas DEMO.
--
-- Las notificaciones de la plataforma se reparten por alcance (todos, un
-- espacio, un plan o un estado de cuenta), y ninguno de esos alcances permite
-- decir "a todos MENOS los demos". El aviso "ingresa al canal VIP de clientes"
-- salia a todas las cuentas activas, y una cuenta demo todavia no es cliente.
--
-- La marca se mira en el momento de mostrar, no en el de crear: cuando un demo
-- paga y pasa a un plan normal, empieza a ver la notificacion si sigue vigente.
-- Eso es justo lo que se quiere con un aviso para clientes.
alter table public.notifications
  add column if not exists excluir_demo boolean not null default false;

comment on column public.notifications.excluir_demo is
  'Si es true, las cuentas con plan DEMO (plans.is_demo) no ven esta notificacion ni oyen su aviso.';

-- Las invitaciones a los grupos o canales de clientes ya enviadas.
update public.notifications
set excluir_demo = true
where cta_url ilike '%chat.whatsapp.com%';

select pg_notify('pgrst', 'reload schema');
