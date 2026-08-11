-- Custom marketing bullet points per plan (separate from the real
-- module-based feature gating in plan_modules) — shown to clients on the
-- plan picker in /dashboard/billing.
alter table plans add column description text[] not null default '{}';
