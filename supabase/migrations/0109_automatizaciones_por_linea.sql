-- Automatizaciones y seguimientos por linea.
--
-- Hasta ahora una automatizacion o seguimiento aplicaba a todas las lineas
-- del espacio. Ahora puede limitarse a una linea (null = todas): las
-- disparadas por mensaje entrante solo corren si el mensaje entro por esa
-- linea, y los seguimientos solo se inscriben para hilos de esa linea.

alter table public.automations
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id) on delete set null;

create index if not exists automations_workspace_linea_idx
  on public.automations (workspace_id, whatsapp_account_id);

-- Misma funcion de 0077 con el filtro por linea en la inscripcion.
create or replace function public.handle_message_for_followups()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ws_id uuid;
  c_id uuid;
  is_followup_step boolean;
  linea_id uuid;
begin
  select workspace_id, contact_id, whatsapp_account_id into ws_id, c_id, linea_id
  from conversations where id = new.conversation_id;
  if ws_id is null then
    return new;
  end if;

  if new.direction = 'in' then
    -- Pause (don't delete) any pending step so its next_position survives
    -- to resume later if the contact goes quiet again.
    update automation_pending_runs
    set paused = true
    where contact_id = c_id
      and automation_id in (
        select id from automations where workspace_id = ws_id and trigger_type = 'no_reply'
      )
      and paused = false;
    return new;
  end if;

  if new.exclude_from_followups then
    return new;
  end if;

  is_followup_step := new.via_automation_id is not null and exists (
    select 1 from automations where id = new.via_automation_id and trigger_type = 'no_reply'
  );
  if is_followup_step then
    return new;
  end if;

  if exists (select 1 from conversations where id = new.conversation_id and followups_enabled = false) then
    return new;
  end if;

  if exists (
    select 1 from contact_tags ct
    join tags t on t.id = ct.tag_id
    where ct.contact_id = c_id and t.excludes_followups
  ) then
    return new;
  end if;

  if exists (select 1 from contacts where id = c_id and likely_blocked) then
    return new;
  end if;

  -- Resume: a paused sequence re-arms 30 minutes after this new outbound
  -- message, at whichever step it was paused on.
  update automation_pending_runs
  set paused = false, run_at = new.created_at + interval '30 minutes'
  where contact_id = c_id
    and automation_id in (
      select id from automations where workspace_id = ws_id and trigger_type = 'no_reply' and is_active = true
    )
    and paused = true;

  -- First start: unchanged from before — only for a contact who has never
  -- triggered this sequence at all yet.
  insert into automation_pending_runs (workspace_id, automation_id, contact_id, next_position, run_at)
  select ws_id, a.id, c_id, first_step.position,
         new.created_at + make_interval(secs => first_step.delay_seconds)
  from automations a
  join lateral (
    select position, delay_seconds from automation_actions
    where automation_id = a.id order by position asc limit 1
  ) first_step on true
  where a.workspace_id = ws_id and a.trigger_type = 'no_reply' and a.is_active = true
    and (a.whatsapp_account_id is null or a.whatsapp_account_id = linea_id)
    and first_step.delay_seconds > 0
    and not exists (
      select 1 from automation_starts s where s.automation_id = a.id and s.contact_id = c_id
    )
    and (
      a.required_tag_id is null
      or exists (
        select 1 from contact_tags ct where ct.contact_id = c_id and ct.tag_id = a.required_tag_id
      )
    );

  insert into automation_starts (automation_id, contact_id)
  select a.id, c_id
  from automations a
  where a.workspace_id = ws_id and a.trigger_type = 'no_reply' and a.is_active = true
    and (a.whatsapp_account_id is null or a.whatsapp_account_id = linea_id)
    and not exists (
      select 1 from automation_starts s where s.automation_id = a.id and s.contact_id = c_id
    )
    and (
      a.required_tag_id is null
      or exists (
        select 1 from contact_tags ct where ct.contact_id = c_id and ct.tag_id = a.required_tag_id
      )
    )
  on conflict do nothing;

  return new;
end;
$function$;

select pg_notify('pgrst', 'reload schema');
