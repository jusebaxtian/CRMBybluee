-- Needed so realtime UPDATE payloads include the previous row values
-- (payload.old), not just the primary key — the AI-handoff alert sound
-- needs to tell "ai_handoff_requested went from false to true" apart from
-- any other update to the row (e.g. last_read_at changing).
alter table conversations replica identity full;
