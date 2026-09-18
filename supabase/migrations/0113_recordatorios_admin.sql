-- Recordatorios: el administrador de la plataforma (modo soporte) tambien
-- los ve y gestiona, como en el resto de tablas del espacio.
drop policy if exists recordatorios_miembros on public.recordatorios;
create policy recordatorios_miembros on public.recordatorios
  for all
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin())
  with check (public.is_workspace_member(workspace_id) or public.is_platform_admin());
