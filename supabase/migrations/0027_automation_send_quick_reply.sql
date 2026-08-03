-- Lets an automation action trigger an existing quick reply's whole flow,
-- instead of duplicating its actions.
alter table automation_actions add column quick_reply_id uuid references quick_replies(id) on delete set null;
