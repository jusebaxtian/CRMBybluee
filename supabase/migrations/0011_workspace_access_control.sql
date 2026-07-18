-- Lets admins lock a workspace out of the CRM (separate from billing status),
-- and fixes a cascade-ordering issue that blocks deleting a workspace: deleting
-- a tag (which happens automatically when the owning workspace is deleted)
-- previously failed if any automation_action still referenced that tag.

alter table workspaces add column access_disabled boolean not null default false;

alter table automation_actions drop constraint automation_actions_tag_id_fkey;
alter table automation_actions
  add constraint automation_actions_tag_id_fkey
  foreign key (tag_id) references tags (id) on delete set null;
