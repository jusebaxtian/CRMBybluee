-- Modo soporte: el administrador de la plataforma ve las citas de la Agenda del
-- cliente (antes la politica solo dejaba a los miembros del espacio y en soporte
-- la Agenda salia vacia). Igual que recordatorios (0113). Se conserva la regla de
-- vendedores de 0160.
drop policy if exists agenda_eventos_miembros on public.agenda_eventos;
create policy agenda_eventos_miembros on public.agenda_eventos
  for all
  using (
    public.is_platform_admin()
    or (
      public.is_workspace_member(workspace_id)
      and (
        not (select public.soy_vendedor())
        or created_by = (select auth.uid())
        or (contact_id is not null and public.contacto_asignado_a_mi(contact_id))
      )
    )
  )
  with check (public.is_workspace_member(workspace_id) or public.is_platform_admin());

select pg_notify('pgrst', 'reload schema');
