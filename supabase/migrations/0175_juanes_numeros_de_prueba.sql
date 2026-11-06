-- Numeros que Juanes atiende aunque este apagado, para probarlo con WhatsApp real sin
-- responderle a ningun cliente. Arranca con el numero de Sebastian.
alter table public.agente_vendedor
  add column if not exists numeros_prueba text[] not null default '{}';

update public.agente_vendedor
set numeros_prueba = array['573166230373']
where nombre = 'Juanes' and numeros_prueba = '{}';
