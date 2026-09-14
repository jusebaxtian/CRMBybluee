-- Cupo de agentes de respuesta adicional por espacio (mismo patron que
-- 0101 para los numeros de WhatsApp): el tope viene del plan
-- (plans.max_agents) y admin puede conceder agentes extra a un cliente
-- concreto sin cambiarle el plan. Tope efectivo = plan + extra.
-- Si el plan no incluye agentes (max_agents = 0), el extra habilita
-- exactamente esa cantidad; si el plan es ilimitado (null), el extra no aplica.
alter table workspaces
  add column if not exists extra_agents integer not null default 0
  check (extra_agents >= 0);

select pg_notify('pgrst', 'reload schema');
