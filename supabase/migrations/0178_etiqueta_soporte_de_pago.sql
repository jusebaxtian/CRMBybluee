-- Etiqueta al detectar un soporte de pago (9 nov 2026), para todas las cuentas.
-- Se activa a mano en cada agente: "Leer imagenes" (lee_imagenes, 0167) y la
-- etiqueta a poner. La lectura usa la llave de IA conectada del cliente y ya no
-- exige que el agente este respondiendo: se puede etiquetar con la IA apagada.
alter table public.ai_agents
  add column if not exists etiqueta_comprobante_id uuid references public.tags(id) on delete set null;

select pg_notify('pgrst', 'reload schema');
