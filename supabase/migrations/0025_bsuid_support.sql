-- WhatsApp's Business-Scoped User ID (BSUID) rollout: since 2026-03-31 every
-- inbound webhook message/contact carries a "user_id" (the BSUID) alongside
-- "wa_id". Starting 2026-06, for a user who has set a WhatsApp username and
-- messages a business for the first time, "wa_id"/"from" itself may contain
-- the BSUID instead of a phone number — "contacts.wa_id" can no longer be
-- assumed to always be a phone number. bsuid is the stable identifier to
-- match a returning contact by even if their wa_id representation changes
-- between messages (e.g. https://developers.facebook.com/docs/whatsapp —
-- BSUID/username docs, 2026).
alter table contacts add column bsuid text;

create unique index contacts_workspace_bsuid_key
  on contacts (workspace_id, bsuid)
  where bsuid is not null;
