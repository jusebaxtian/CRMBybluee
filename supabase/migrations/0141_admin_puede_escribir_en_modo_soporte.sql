-- El administrador de la plataforma, en "modo soporte", tiene que poder hacer
-- en el espacio de un cliente lo mismo que el cliente.
--
-- En cinco tablas la regla de LECTURA y de BORRADO ya incluia al administrador,
-- pero la de ESCRITURA (WITH CHECK) no: podia ver y borrar, pero no crear ni
-- modificar. Lo que se notaba: al mandar una plantilla a un contacto nuevo en
-- el espacio de un cliente, la base rechazaba crear la conversacion y el chat
-- decia "No se pudo abrir la conversacion". Solo funcionaba con contactos que
-- ya tenian conversacion.
--
--   conversations   crear conversaciones (conversations_insert)
--   templates       crear y editar plantillas
--   quick_replies   crear y editar respuestas rapidas
--   ai_agents       crear y editar el agente de IA
--   ai_agent_media  subir y cambiar los archivos del agente de IA
--
-- Nadie mas gana permisos: un usuario sigue pudiendo escribir solo en los
-- espacios de los que es miembro. Es lo que ya hacen las demas tablas del
-- espacio (contactos, etiquetas, campañas, automatizaciones...).
begin;

alter policy conversations_insert on public.conversations
  with check (
    (select is_platform_admin())
    or workspace_id in (select m.workspace_id from workspace_members m where m.user_id = (select auth.uid()))
  );

alter policy templates_all on public.templates
  with check (is_workspace_member(workspace_id) or (select is_platform_admin()));

alter policy quick_replies_all on public.quick_replies
  with check (is_workspace_member(workspace_id) or (select is_platform_admin()));

alter policy ai_agents_all on public.ai_agents
  with check (is_workspace_member(workspace_id) or (select is_platform_admin()));

alter policy ai_agent_media_all on public.ai_agent_media
  with check (is_workspace_member(workspace_id) or (select is_platform_admin()));

commit;
