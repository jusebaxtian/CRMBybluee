-- Platform-wide settings (singleton key/value), starting with the dashboard banner image.

create table platform_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;

create policy "platform_settings_select" on platform_settings
  for select using (true);

create policy "platform_settings_admin_write" on platform_settings
  for all using (is_platform_admin()) with check (is_platform_admin());

-- Public bucket: the banner is meant to be visible to every client's dashboard.
insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;
