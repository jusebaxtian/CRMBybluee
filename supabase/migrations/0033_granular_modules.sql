insert into modules (key, name) values
  ('templates', 'Plantillas'),
  ('followups', 'Seguimientos'),
  ('tags', 'Etiquetas'),
  ('reports', 'Reportes')
on conflict (key) do nothing;

-- Backfill: these features used to be bundled under "campaigns" (templates,
-- followups) or had no gate at all (tags, reports) — grant them to every
-- plan that already had campaigns/existing access so nobody currently paying
-- loses access to a feature they already use once the new gates ship.
insert into plan_modules (plan_id, module_key)
select plan_id, 'templates' from plan_modules where module_key = 'campaigns'
on conflict do nothing;

insert into plan_modules (plan_id, module_key)
select plan_id, 'followups' from plan_modules where module_key = 'campaigns'
on conflict do nothing;

insert into plan_modules (plan_id, module_key)
select id, 'tags' from plans
on conflict do nothing;

insert into plan_modules (plan_id, module_key)
select id, 'reports' from plans
on conflict do nothing;
