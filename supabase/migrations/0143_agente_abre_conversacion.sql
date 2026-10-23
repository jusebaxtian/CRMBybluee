-- Un agente (rol 'agent') solo ve las conversaciones asignadas a el. Al abrir
-- un chat nuevo ("Enviar plantilla" / mensaje nuevo a un contacto) la
-- conversacion se creaba sin asignar, el agente no podia leerla de vuelta y
-- la accion fallaba con "No se pudo abrir la conversacion".
--
-- Esta funcion abre (o reutiliza) la conversacion y, si quien la abre es un
-- agente, se la asigna a el. Si ya la atiende otro agente, avisa en vez de
-- tomarla. Duenos y admins no cambian: ya ven todas.
begin;

create or replace function public.abrir_conversacion_como_miembro(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_account_id uuid,
  p_default_account_id uuid
)
returns table (id uuid, whatsapp_account_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := workspace_role(p_workspace_id);
  v_yo uuid := auth.uid();
  v_conv conversations%rowtype;
begin
  if v_yo is null or v_rol is null then
    raise exception 'no_miembro';
  end if;
  if not exists (select 1 from contacts c where c.id = p_contact_id and c.workspace_id = p_workspace_id) then
    raise exception 'contacto_no_encontrado';
  end if;

  select * into v_conv from conversations c
  where c.workspace_id = p_workspace_id and c.contact_id = p_contact_id
    and (p_account_id is null or c.whatsapp_account_id = p_account_id)
  order by c.last_message_at desc nulls last
  limit 1;

  if found then
    if v_rol = 'agent' then
      if v_conv.assigned_agent_id is null then
        update conversations c set assigned_agent_id = v_yo where c.id = v_conv.id;
      elsif v_conv.assigned_agent_id <> v_yo then
        raise exception 'atendida_por_otro';
      end if;
    end if;
    return query select v_conv.id, v_conv.whatsapp_account_id;
    return;
  end if;

  insert into conversations as c (workspace_id, contact_id, whatsapp_account_id, assigned_agent_id)
  values (
    p_workspace_id, p_contact_id,
    coalesce(p_account_id, p_default_account_id),
    case when v_rol = 'agent' then v_yo else null end
  )
  returning * into v_conv;
  return query select v_conv.id, v_conv.whatsapp_account_id;
end;
$$;

revoke all on function public.abrir_conversacion_como_miembro(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.abrir_conversacion_como_miembro(uuid, uuid, uuid, uuid) to authenticated;

commit;
