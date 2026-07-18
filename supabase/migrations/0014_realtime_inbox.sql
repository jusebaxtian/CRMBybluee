-- Enable Supabase Realtime (Postgres logical replication) for the inbox so the
-- chat and conversation list update live instead of requiring a manual reload.

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
