-- Separate from ai_handoff_requested (set automatically when the AI itself
-- decides/detects it should defer) — this is a manual override so an agent
-- can pause the AI on a specific chat to take over personally, independent
-- of whether the AI ever asked for help.
alter table conversations add column ai_manually_paused boolean not null default false;
