-- La etiqueta "Más popular" estaba hardcodeada en las landings con un
-- `plan.name.toLowerCase().includes("pro")`, así que no se podía cambiar el
-- texto ni moverla a otro plan sin tocar código. Ahora es un campo editable
-- desde /admin/plans.
--
-- Vacío/null = el plan se muestra sin ninguna insignia (comportamiento por
-- defecto); con texto = se pinta esa insignia tal cual se escribió.
alter table plans
  add column badge_label text;

-- Conserva el comportamiento que había hasta ahora: el plan "Pro" era el
-- único que mostraba la insignia.
update plans
set badge_label = 'Más popular'
where lower(name) like '%pro%';

select pg_notify('pgrst', 'reload schema');
