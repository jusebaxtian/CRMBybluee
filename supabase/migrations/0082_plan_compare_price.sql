-- Precio de comparacion ("antes"): se pinta tachado junto al precio real y
-- permite calcular cuanto ahorra el cliente. Es opcional: null = la web
-- muestra unicamente el precio normal, sin tachado ni "Ahorras".
--
-- Se guarda en centavos igual que price_cents para no mezclar unidades.
alter table plans
  add column compare_price_cents bigint;

-- Un precio de comparacion que no sea mayor al real daria un ahorro de cero o
-- negativo en la landing, asi que se descarta a nivel de base de datos.
alter table plans
  add constraint plans_compare_price_gt_price
  check (compare_price_cents is null or compare_price_cents > price_cents);

select pg_notify('pgrst', 'reload schema');
