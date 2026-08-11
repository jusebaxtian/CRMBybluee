-- Plans could only be monthly or yearly — adds a semiannual (6-month) option
-- so plan creation can offer 1 month / 6 months / 1 year cycles.
alter table plans drop constraint plans_billing_cycle_check;
alter table plans add constraint plans_billing_cycle_check
  check (billing_cycle = any (array['monthly', 'semiannual', 'yearly']));
