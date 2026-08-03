-- WhatsApp's webhook includes a "referral" object on the first inbound
-- message of a "Click to WhatsApp" (CTWA) ad conversation. Storing it on the
-- conversation lets the UI flag which chats came from paid Meta Ads.
alter table conversations add column ad_source_id text;
alter table conversations add column ad_headline text;
alter table conversations add column ad_body text;
alter table conversations add column ctwa_clid text;
