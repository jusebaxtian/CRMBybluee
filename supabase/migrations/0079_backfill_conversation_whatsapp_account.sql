-- CRITICAL FIX: conversations.whatsapp_account_id being null caused every
-- future inbound message for that contact to be silently dropped forever.
-- ingest.ts upserts conversations with
-- onConflict("workspace_id,contact_id,whatsapp_account_id") — but a row
-- with whatsapp_account_id null doesn't match that 3-column unique
-- constraint against a non-null value being upserted, so Postgres instead
-- collides with the OTHER unique constraint (workspace_id,contact_id),
-- which DOES already have a row. That's a genuine unique-violation error —
-- silently swallowed because ingest.ts never checked it, so it looked
-- exactly like "nothing arrived" from every angle (no error logged, no
-- message inserted, no automation ever ran).
--
-- 3,099 conversations system-wide had whatsapp_account_id null (any
-- conversation created before the multi-WhatsApp-numbers feature started
-- populating it). Backfilling with the same fallback resolveSendAccount()
-- already uses (workspace's earliest-connected non-frozen number) makes
-- every future upsert for these hit the 3-column constraint correctly
-- instead of colliding.
update conversations c
set whatsapp_account_id = fallback.id
from (
  select distinct on (workspace_id) workspace_id, id
  from whatsapp_accounts
  where status != 'frozen'
  order by workspace_id, connected_at asc
) fallback
where c.whatsapp_account_id is null
  and c.workspace_id = fallback.workspace_id;
