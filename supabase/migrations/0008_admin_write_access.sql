-- Several "with check" clauses only allowed is_workspace_member(), so platform
-- admins could see everything (the "using" clause included is_platform_admin())
-- but could not INSERT/UPDATE rows while impersonating a workspace in support
-- mode. Add the admin bypass to the write-side check on every affected table.

drop policy "whatsapp_accounts_insert" on whatsapp_accounts;
create policy "whatsapp_accounts_insert" on whatsapp_accounts
  for insert with check (is_workspace_member(workspace_id) or is_platform_admin());

drop policy "contacts_all" on contacts;
create policy "contacts_all" on contacts
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());

drop policy "tags_all" on tags;
create policy "tags_all" on tags
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());

drop policy "contact_tags_all" on contact_tags;
create policy "contact_tags_all" on contact_tags
  for all using (
    exists (select 1 from contacts c where c.id = contact_id and (is_workspace_member(c.workspace_id) or is_platform_admin()))
  )
  with check (
    exists (select 1 from contacts c where c.id = contact_id and (is_workspace_member(c.workspace_id) or is_platform_admin()))
  );

drop policy "conversations_all" on conversations;
create policy "conversations_all" on conversations
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());

drop policy "campaigns_all" on campaigns;
create policy "campaigns_all" on campaigns
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());

drop policy "automations_all" on automations;
create policy "automations_all" on automations
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());

drop policy "notification_reads_all" on notification_reads;
create policy "notification_reads_all" on notification_reads
  for all using (is_workspace_member(workspace_id) or is_platform_admin())
  with check (is_workspace_member(workspace_id) or is_platform_admin());
