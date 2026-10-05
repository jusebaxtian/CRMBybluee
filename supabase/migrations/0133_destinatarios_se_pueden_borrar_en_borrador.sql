-- Editar una campaña en borrador tiene que poder rehacer su lista de destinatarios.
--
-- `campaign_recipients` tiene politicas de select, insert y update, pero NO de
-- delete. Con RLS activa, un delete sin politica no falla: borra cero filas y
-- no avisa. updateCampaign borra los destinatarios viejos y vuelve a insertar
-- los nuevos, asi que el borrado nunca ocurria y el insert chocaba con las
-- filas que seguian ahi (unique campaign_id, contact_id).
--
-- Mientras el codigo ignoraba el error del insert, el choque pasaba
-- desapercibido: la edicion guardaba los ajustes de la campaña y la lista de
-- destinatarios se quedaba como estaba. El 5 oct 2026 un borrador con un
-- filtro mal puesto siguio en 3 destinatarios aunque se corrigio el filtro.
--
-- Solo en borrador: una campaña que ya se envio conserva su historial.
create policy campaign_recipients_delete on public.campaign_recipients
  for delete
  using (
    (select public.is_platform_admin())
    or exists (
      select 1 from public.campaigns c
      where c.id = campaign_recipients.campaign_id
        and c.status = 'draft'
        and c.workspace_id in (
          select m.workspace_id from public.workspace_members m
          where m.user_id = (select auth.uid())
        )
    )
  );

select pg_notify('pgrst', 'reload schema');
