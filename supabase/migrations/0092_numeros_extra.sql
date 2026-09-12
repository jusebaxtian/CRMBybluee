-- Cupo de numeros de WhatsApp adicional por espacio.
--
-- El tope viene del plan (plans.max_whatsapp_numbers). Cuando un cliente
-- concreto pide un numero mas de los que trae su plan, no tiene sentido ni
-- subirle el plan entero ni crear un plan solo para el: se le concede un cupo
-- extra desde admin, solo a ese espacio. El tope efectivo es plan + extra.
alter table workspaces
  add column if not exists extra_whatsapp_numbers integer not null default 0
  check (extra_whatsapp_numbers >= 0);

select pg_notify('pgrst', 'reload schema');
