-- Replaces the old Pro/Starter pricing with the new Inicial/Pro/Semestral
-- structure the user defined. Existing plan rows are updated in place
-- (rather than inserted fresh) so workspaces.plan_id / subscriptions FKs
-- keep pointing at the same rows — this intentionally changes what the 11
-- existing subscribed workspaces see, per explicit confirmation.

alter table plans add column if not exists max_agents integer; -- null = unlimited

-- "Pro" ($100.000/mes) -> "Inicial" ($99.000/mes): no IA, no reportes, no agentes
update plans
set name = 'Inicial', price_cents = 9900000, max_agents = 0
where id = '6e8df284-1ea8-4c43-8092-f1f5dcd041a6';

delete from plan_modules
where plan_id = '6e8df284-1ea8-4c43-8092-f1f5dcd041a6' and module_key in ('ai_agent', 'reports');

-- "Starter" ($220.000/mes) -> "Pro" ($150.000/mes): IA + reportes, hasta 3 agentes
update plans
set name = 'Pro', price_cents = 15000000, max_agents = 3
where id = 'cd442287-517e-4566-93cf-a11b8481ddfc';

-- (already has ai_agent + reports in plan_modules — no change needed there)

-- "Starter/Anual" (inactive, $300.000/año) -> "Semestral" ($700.000/6 meses):
-- todas las funcionalidades, agentes ilimitados
update plans
set name = 'Semestral', price_cents = 70000000, billing_cycle = 'semiannual',
    is_active = true, max_agents = null
where id = 'ad231d6c-988f-447a-9bfb-c3a83b00e604';

-- (already has the full module set — no change needed there)
