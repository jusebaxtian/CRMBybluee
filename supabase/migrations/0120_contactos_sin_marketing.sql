-- Contactos que le dijeron a WhatsApp que no quieren mas mensajes de
-- marketing de este negocio (error 131050 de Meta).
--
-- Hasta ahora eso solo se podia averiguar rastreando el error de los mensajes
-- fallidos uno por uno: en la linea de ventas de Bybluee eran 9 mensajes
-- rechazados a 4 personas, y a una se le insistio 7 veces. Cada insistencia
-- pesa contra la calidad del numero, asi que el dato tiene que estar a la
-- vista y ser filtrable, no escondido en un log.
alter table public.contacts
  add column if not exists marketing_opt_out_at timestamptz;

comment on column public.contacts.marketing_opt_out_at is
  'Cuando Meta informo que este contacto ya no quiere mensajes de marketing (error 131050). Queda fuera de campañas y seguimientos.';

-- Parcial: solo interesan los que si optaron por salir, que son pocos.
create index if not exists contacts_marketing_opt_out_idx
  on public.contacts (workspace_id, marketing_opt_out_at)
  where marketing_opt_out_at is not null;

-- Relleno de los que ya se sabe, sacados del motivo de sus mensajes
-- fallidos: el texto en ingles de Meta y la traduccion que guarda el CRM
-- desde que se traducen los errores.
with optout as (
  select c.contact_id, max(m.created_at) as cuando
  from messages m
  join conversations c on c.id = m.conversation_id
  where m.status = 'failed'
    and (
      m.error_detail ilike '%stop receiving marketing%'
      or m.error_detail ilike '%no quiere recibir mensajes de marketing%'
      or m.error_detail ilike '%pidió no recibir%'
    )
  group by c.contact_id
)
update public.contacts ct
set marketing_opt_out_at = optout.cuando
from optout
where ct.id = optout.contact_id
  and ct.marketing_opt_out_at is null;

select pg_notify('pgrst', 'reload schema');
