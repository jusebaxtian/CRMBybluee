-- Distinguishes templates created through the CRM's own "Crear plantilla"
-- form from ones that only exist because a Meta-native template got pulled
-- in by syncTemplates(). Going forward, the templates page only shows/uses
-- 'crm' ones — a template must be created here to be usable in campaigns/
-- automations, per the client's request. The 23 templates that already
-- existed before this migration are backfilled to 'crm' so nothing already
-- in use (e.g. citytours' active campaign template) disappears — only
-- templates created directly in Meta from this point forward get hidden.
alter table templates
  add column created_via text not null default 'meta';

alter table templates
  add constraint templates_created_via_check check (created_via in ('crm', 'meta'));

update templates set created_via = 'crm';

select pg_notify('pgrst', 'reload schema');
