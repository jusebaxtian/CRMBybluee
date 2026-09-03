-- templates had no real creation timestamp — only synced_at, which gets
-- touched on every "Sincronizar" click for every row, so it can't be used
-- to order "most recently created first". created_at defaults to now() on
-- INSERT only; every upsert call site omits it from the payload, so a
-- resync never touches it going forward, unlike synced_at.
alter table templates
  add column created_at timestamptz not null default now();

-- Best available proxy for existing rows' original creation order — not
-- perfect (a resync before this migration already moved synced_at), but
-- better than leaving them all tied at "now".
update templates set created_at = synced_at;

select pg_notify('pgrst', 'reload schema');
