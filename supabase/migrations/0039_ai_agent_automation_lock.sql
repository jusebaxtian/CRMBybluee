-- Tracks which keyword/tag_added automations were auto-paused when the AI
-- agent was turned on, so turning the AI back off can restore exactly those
-- (and only those) — an automation the user had already paused on their own
-- stays paused.
alter table automations add column disabled_by_ai boolean not null default false;
