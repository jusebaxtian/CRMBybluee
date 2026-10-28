-- Ajustes de vendedores (28 oct 2026).
--
-- 1) Un mismo cliente puede comprar varias licencias (un espacio por cada enlace
--    de registro). Cada licencia NUEVA da comision; lo que no la da es renovar
--    una licencia que ya existia. La unicidad pasa de "una venta por contacto" a
--    "una venta por enlace de registro" y "una por pago".
drop index if exists public.ventas_vendedor_una_por_contacto;
create unique index if not exists ventas_vendedor_una_por_enlace
  on public.ventas_vendedor (invitacion_id) where estado <> 'anulada' and invitacion_id is not null;
create unique index if not exists ventas_vendedor_una_por_pago
  on public.ventas_vendedor (payment_id) where estado <> 'anulada' and payment_id is not null;
create index if not exists ventas_vendedor_por_contacto on public.ventas_vendedor (contact_id);

-- 2) Avisos de la campana solo para dueño y administradores del espacio (p. ej.
--    "el vendedor X registro una venta"): los vendedores y asesores no los ven.
alter table public.notifications add column if not exists solo_admins boolean not null default false;

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
    )
  );

-- 3) El vendedor ve los enlaces de registro que se generaron para SUS contactos
--    (los que tiene asignados), igual que el administrador en el panel del chat.
drop policy if exists "invitaciones_registro_vendedor" on public.invitaciones_registro;
create policy "invitaciones_registro_vendedor" on public.invitaciones_registro
  for select using (contact_id is not null and public.es_vendedor_del_contacto(contact_id));

notify pgrst, 'reload schema';
