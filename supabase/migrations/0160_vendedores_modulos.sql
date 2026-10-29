-- Vendedores: ademas de Conversaciones, entran a Dashboard, Contactos y Agenda,
-- pero solo con lo SUYO (contactos con un chat asignado a el, sus recordatorios
-- y sus citas). Los duenos/administradores del espacio siguen viendo todo.
-- Solo aplica a usuarios con fila activa en `vendedores`: los asesores
-- normales de los clientes quedan exactamente igual.

create or replace function public.soy_vendedor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.vendedores where user_id = auth.uid() and activo);
$$;
revoke all on function public.soy_vendedor() from public, anon;
grant execute on function public.soy_vendedor() to authenticated, service_role;

-- ¿Este contacto tiene un chat asignado a quien consulta?
create or replace function public.contacto_asignado_a_mi(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.conversations where contact_id = p_contact_id and assigned_agent_id = auth.uid());
$$;
revoke all on function public.contacto_asignado_a_mi(uuid) from public, anon;
grant execute on function public.contacto_asignado_a_mi(uuid) to authenticated, service_role;

-- 1) Contactos: el vendedor solo ve/edita los suyos. Crear sigue igual.
drop policy if exists contacts_all on public.contacts;
drop policy if exists contacts_select on public.contacts;
drop policy if exists contacts_insert on public.contacts;
drop policy if exists contacts_update on public.contacts;
drop policy if exists contacts_delete on public.contacts;

create policy contacts_insert on public.contacts
  for insert with check (
    (select is_platform_admin())
    or workspace_id in (select m.workspace_id from workspace_members m where m.user_id = (select auth.uid()))
  );

create policy contacts_select on public.contacts
  for select using (
    (select is_platform_admin())
    or (
      workspace_id in (select m.workspace_id from workspace_members m where m.user_id = (select auth.uid()))
      and (not (select public.soy_vendedor()) or public.contacto_asignado_a_mi(id))
    )
  );

create policy contacts_update on public.contacts
  for update using (
    (select is_platform_admin())
    or (
      workspace_id in (select m.workspace_id from workspace_members m where m.user_id = (select auth.uid()))
      and (not (select public.soy_vendedor()) or public.contacto_asignado_a_mi(id))
    )
  ) with check (
    (select is_platform_admin())
    or workspace_id in (select m.workspace_id from workspace_members m where m.user_id = (select auth.uid()))
  );

create policy contacts_delete on public.contacts
  for delete using (
    (select is_platform_admin())
    or (
      workspace_id in (select m.workspace_id from workspace_members m where m.user_id = (select auth.uid()))
      and not (select public.soy_vendedor())
    )
  );

-- 2) Recordatorios: el vendedor ve los que creo o los de sus chats.
drop policy if exists recordatorios_miembros on public.recordatorios;
create policy recordatorios_miembros on public.recordatorios
  for all
  using (
    public.is_platform_admin()
    or (
      public.is_workspace_member(workspace_id)
      and (not (select public.soy_vendedor()) or created_by = (select auth.uid()) or public.contacto_asignado_a_mi(contact_id))
    )
  )
  with check (public.is_workspace_member(workspace_id) or public.is_platform_admin());

-- 3) Citas de la agenda: igual.
drop policy if exists agenda_eventos_miembros on public.agenda_eventos;
create policy agenda_eventos_miembros on public.agenda_eventos
  for all
  using (
    public.is_workspace_member(workspace_id)
    and (
      not (select public.soy_vendedor())
      or created_by = (select auth.uid())
      or (contact_id is not null and public.contacto_asignado_a_mi(contact_id))
    )
  )
  with check (public.is_workspace_member(workspace_id));

-- 4) Avisos personales: el aviso de un recordatorio de un vendedor le llega
--    solo a el (target_user_id). Los demas avisos (target_user_id vacio) igual que antes.
alter table public.notifications add column if not exists target_user_id uuid references auth.users(id) on delete cascade;

drop policy if exists "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications
  for select using (
    is_platform_admin()
    or (
      (
        scope = 'all'
        or (scope = 'workspace' and is_workspace_member(target_workspace_id))
        or (scope = 'plan' and exists (
          select 1 from workspaces w
          where w.plan_id = target_plan_id and is_workspace_member(w.id)
        ))
        or (scope = 'status' and exists (
          select 1 from workspaces w
          where w.status = target_status and is_workspace_member(w.id)
        ))
      )
      and (
        not solo_admins
        or exists (
          select 1 from workspace_members m
          where m.workspace_id = target_workspace_id and m.user_id = auth.uid() and m.role in ('owner', 'admin')
        )
      )
      and (target_user_id is null or target_user_id = auth.uid())
    )
  );

select pg_notify('pgrst', 'reload schema');
