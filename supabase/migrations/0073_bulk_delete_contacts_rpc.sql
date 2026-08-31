-- bulkDeleteContacts() built `?id=in.(uuid,uuid,...)` — with hundreds of
-- contacts selected (e.g. "eliminar todos") that query string trips
-- nginx's URL-length limit, returning a literal 414 "Request-URI Too
-- Large" instead of deleting anything. Same root cause as the earlier
-- campaign-audience 502 bug, fixed the same way: move the id list into an
-- RPC call, where it travels in the POST body instead of the URL.
create or replace function bulk_delete_contacts(p_workspace_id uuid, p_contact_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  delete from contacts
  where workspace_id = p_workspace_id
    and id = any(p_contact_ids);
$$;
