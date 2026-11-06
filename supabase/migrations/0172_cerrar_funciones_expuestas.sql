-- Varias funciones SECURITY DEFINER no revisaban quien las llamaba y se podian
-- ejecutar sin sesion: con el id de un espacio se leia su bandeja y se podian
-- borrar sus contactos. Hallado el 5 nov 2026.
--
-- Ahora solo las llaman el servicio, los miembros del espacio y el administrador
-- de la plataforma (modo soporte). Quien no pasa recibe vacio, no un error.
--
-- OJO al modificar estas funciones en el futuro: la logica vive en <nombre>__interno
-- y la funcion publica solo valida y la llama.

create or replace function public.puede_ver_espacio(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or public.is_workspace_member(p_workspace_id)
    or public.is_platform_admin();
$$;
revoke all on function public.puede_ver_espacio(uuid) from public, anon;
grant execute on function public.puede_ver_espacio(uuid) to authenticated, service_role;

do $$
declare
  r record;
  nombres text;
  guardia text;
begin
  for r in
    select p.oid, p.proname, p.pronargs, p.proargnames,
      pg_get_function_identity_arguments(p.oid) as identidad,
      pg_get_function_arguments(p.oid) as argumentos,
      pg_get_function_result(p.oid) as resultado
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'inbox_page', 'inbox_conversation_summaries', 'inbox_conversation_summaries_for', 'inbox_unread_count',
        'tag_contact_counts', 'resolve_campaign_recipients',
        'campaign_active_chat_recipient_ids', 'campaign_no_followup_recipient_ids'
      ])
  loop
    select string_agg(format('%I', n), ', ') into nombres from unnest(r.proargnames[1:r.pronargs]) as n;

    guardia := case
      when r.proname like 'campaign\_%' then
        '(coalesce(auth.role(), '''') = ''service_role'' or public.is_platform_admin() or public.is_workspace_member_via_campaign(p_campaign_id))'
      else 'public.puede_ver_espacio(p_workspace_id)'
    end;

    execute format('alter function public.%I(%s) rename to %I', r.proname, r.identidad, r.proname || '__interno');
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname || '__interno', r.identidad);

    execute format(
      'create function public.%I(%s) returns %s language sql stable security definer set search_path = public as %L',
      r.proname, r.argumentos, r.resultado,
      format('select * from public.%I(%s) where %s;', r.proname || '__interno', nombres, guardia)
    );
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.identidad);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.identidad);
  end loop;
end;
$$;

-- Borrar contactos en bloque: solo dentro de un espacio propio.
create or replace function public.bulk_delete_contacts(p_workspace_id uuid, p_contact_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  delete from contacts
  where workspace_id = p_workspace_id
    and id = any(p_contact_ids)
    and public.puede_ver_espacio(p_workspace_id);
$$;
revoke all on function public.bulk_delete_contacts(uuid, uuid[]) from public, anon;
grant execute on function public.bulk_delete_contacts(uuid, uuid[]) to authenticated, service_role;

-- Estas validan por dentro, pero nadie sin sesion tiene por que llamarlas.
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as identidad
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'campaign_failure_reasons', 'campaign_recipient_counts', 'dashboard_contactos_por_etiqueta', 'dashboard_leads_por_dia',
        'dashboard_mensajes', 'dashboard_tiempo_respuesta', 'dashboard_uso_diario', 'expire_lapsed_active_subscriptions'
      ])
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.identidad);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.identidad);
  end loop;
end;
$$;

select pg_notify('pgrst', 'reload schema');
