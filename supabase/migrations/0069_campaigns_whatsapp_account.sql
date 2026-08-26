-- Phase 3 of multi-number support: campaigns are a genuinely new outbound
-- send (no existing conversation to inherit a channel from), so they need
-- an explicit "send from" choice. Null = resolved at send time to the
-- workspace's first non-frozen number (see resolveSendAccount), so existing
-- single-number campaigns/workspaces need no backfill.
alter table campaigns add column if not exists whatsapp_account_id uuid
  references whatsapp_accounts(id) on delete set null;
