-- Politicas de seguridad que se evaluan una vez por consulta, no una vez por
-- fila.
--
-- El problema medido el 28 sep 2026 en produccion: abrir un chat tardaba ~10
-- segundos. La misma consulta directa en la base tarda 1,4 ms y a traves de
-- la API, con RLS, 182,8 ms. No era la consulta: era la politica.
-- `is_workspace_member_via_conversation(conversation_id)` se ejecuta una vez
-- por CADA mensaje, y por dentro consulta conversations, workspace_members y
-- platform_admins. Un chat de 700 mensajes hacia 2.100 consultas extra.
--
-- El cambio no toca ni una regla de acceso: reescribe las mismas condiciones
-- para que las partes caras queden como subconsultas escalares o conjuntos
-- (`in (select ...)`), que PostgreSQL evalua una sola vez por consulta y
-- reutiliza para todas las filas.
--
-- Medido en pruebas sobre el mismo chat: 60 ms -> 6,6 ms.
--
-- Equivalencias que sostienen que el acceso no cambia:
--   is_workspace_member(w)  ==  w in (select workspace_id from workspace_members where user_id = auth.uid())
--   workspace_role(w) = 'x' ==  w in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'x')

-- --------------------------------------------------------------------------
-- contacts
-- --------------------------------------------------------------------------
alter policy contacts_all on public.contacts
using (
  (select public.is_platform_admin())
  or workspace_id in (
    select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
  )
)
with check (
  (select public.is_platform_admin())
  or workspace_id in (
    select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
  )
);

-- --------------------------------------------------------------------------
-- conversations (leer y actualizar: dueño/admin todo, agente solo lo suyo)
-- --------------------------------------------------------------------------
alter policy conversations_select on public.conversations
using (
  (select public.is_platform_admin())
  or workspace_id in (
    select m.workspace_id from public.workspace_members m
    where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  )
  or (
    assigned_agent_id = (select auth.uid())
    and workspace_id in (
      select m.workspace_id from public.workspace_members m
      where m.user_id = (select auth.uid()) and m.role = 'agent'
    )
  )
);

alter policy conversations_update on public.conversations
using (
  (select public.is_platform_admin())
  or workspace_id in (
    select m.workspace_id from public.workspace_members m
    where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  )
  or (
    assigned_agent_id = (select auth.uid())
    and workspace_id in (
      select m.workspace_id from public.workspace_members m
      where m.user_id = (select auth.uid()) and m.role = 'agent'
    )
  )
)
with check (
  (select public.is_platform_admin())
  or workspace_id in (
    select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
  )
);

-- Borrar sigue siendo solo de dueño/admin: el agente nunca pudo y no puede.
alter policy conversations_delete on public.conversations
using (
  (select public.is_platform_admin())
  or workspace_id in (
    select m.workspace_id from public.workspace_members m
    where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  )
);

alter policy conversations_insert on public.conversations
with check (
  workspace_id in (
    select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
  )
);

-- --------------------------------------------------------------------------
-- messages (la tabla que hacia lento el chat: 105.000 filas)
-- --------------------------------------------------------------------------
alter policy messages_select on public.messages
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.workspace_id in (
          select m.workspace_id from public.workspace_members m
          where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
        )
        or (
          c.assigned_agent_id = (select auth.uid())
          and c.workspace_id in (
            select m.workspace_id from public.workspace_members m
            where m.user_id = (select auth.uid()) and m.role = 'agent'
          )
        )
      )
  )
);

alter policy messages_update on public.messages
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.workspace_id in (
          select m.workspace_id from public.workspace_members m
          where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
        )
        or (
          c.assigned_agent_id = (select auth.uid())
          and c.workspace_id in (
            select m.workspace_id from public.workspace_members m
            where m.user_id = (select auth.uid()) and m.role = 'agent'
          )
        )
      )
  )
);

-- --------------------------------------------------------------------------
-- campaign_recipients (30.000 filas: la lista de una campaña grande)
-- --------------------------------------------------------------------------
alter policy campaign_recipients_select on public.campaign_recipients
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_recipients.campaign_id
      and c.workspace_id in (
        select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
      )
  )
);

alter policy campaign_recipients_update on public.campaign_recipients
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_recipients.campaign_id
      and c.workspace_id in (
        select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
      )
  )
);

alter policy campaign_recipients_insert on public.campaign_recipients
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.campaigns c
    where c.id = campaign_recipients.campaign_id
      and c.workspace_id in (
        select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
      )
  )
);

-- --------------------------------------------------------------------------
-- contact_tags (30.000 filas: las etiquetas de la tabla de contactos)
-- --------------------------------------------------------------------------
alter policy contact_tags_all on public.contact_tags
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.contacts c
    where c.id = contact_tags.contact_id
      and c.workspace_id in (
        select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
      )
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.contacts c
    where c.id = contact_tags.contact_id
      and c.workspace_id in (
        select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())
      )
  )
);

select pg_notify('pgrst', 'reload schema');
