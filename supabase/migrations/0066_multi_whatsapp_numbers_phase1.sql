-- Phase 1 of multi-number support (up to 3 WhatsApp numbers per workspace,
-- shared WABA, gated by plan). Purely additive/structural — no app code
-- depends on the new columns yet, so this is safe to apply ahead of the UI
-- work in later phases. Every existing workspace has exactly one
-- whatsapp_accounts row today, so all backfills below are unambiguous.

-- 1. Plan-level cap. null = unlimited (kept as an option, though today's
--    plans all use a concrete number).
alter table plans add column if not exists max_whatsapp_numbers integer;
update plans set max_whatsapp_numbers = 3 where name = 'Semestral';
update plans set max_whatsapp_numbers = 1 where name in ('Inicial', 'Pro');

-- 2. whatsapp_accounts: was unique per workspace (one row, upserted on every
--    reconnect via onConflict "workspace_id" in connectWhatsApp()) — now
--    unique per (workspace, phone number), so a workspace can hold up to N
--    rows. That upsert's onConflict target changes in the same commit as
--    this migration (src/app/actions/whatsapp.ts), so schema and code move
--    together. Add a friendly label ("Ventas", "Soporte") since "your one
--    number" no longer needs distinguishing but three do, and a 'frozen'
--    status for numbers past a plan's downgrade cap (data kept,
--    sends/receives blocked — see phase 4/5 of the multi-number plan).
alter table whatsapp_accounts drop constraint whatsapp_accounts_workspace_id_key;
alter table whatsapp_accounts add constraint whatsapp_accounts_workspace_id_phone_number_id_key
  unique (workspace_id, phone_number_id);
alter table whatsapp_accounts add column if not exists label text;
alter table whatsapp_accounts drop constraint whatsapp_accounts_status_check;
alter table whatsapp_accounts add constraint whatsapp_accounts_status_check
  check (status = any (array['connected', 'disconnected', 'error', 'frozen']));

-- 3. conversations: record which of the workspace's numbers this thread
--    belongs to, so the same contact can have a separate conversation per
--    channel instead of collapsing into one. Backfilled from each
--    workspace's current (only) account.
alter table conversations add column if not exists whatsapp_account_id uuid
  references whatsapp_accounts(id) on delete set null;

update conversations c
set whatsapp_account_id = wa.id
from whatsapp_accounts wa
where wa.workspace_id = c.workspace_id
  and c.whatsapp_account_id is null;

create index if not exists conversations_whatsapp_account_id_idx
  on conversations (whatsapp_account_id);

-- Add the new 3-column uniqueness for the future multi-channel case, but
-- deliberately KEEP the original 2-column UNIQUE(workspace_id, contact_id)
-- alongside it (both hold today, since every workspace still has exactly
-- one account) — four existing upsert call sites (ingest.ts's
-- inbound-webhook conversation creation, automations/engine.ts,
-- campaigns/send.ts, actions/whatsapp.ts) target onConflict
-- "workspace_id,contact_id" and need that exact constraint to exist.
-- Dropping it here (as the first version of this migration briefly did)
-- breaks conversation creation on every new inbound WhatsApp message.
-- Phase 3 will migrate those call sites to key off the channel too, at
-- which point the 2-column constraint can be retired.
alter table conversations add constraint conversations_workspace_id_contact_id_whatsapp_account_id_key
  unique (workspace_id, contact_id, whatsapp_account_id);
