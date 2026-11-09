-- Mensajes programados desde el chat (9 nov 2026). Al llegar la hora:
-- - Con la ventana de 24 h abierta sale el mensaje libre.
-- - Con la ventana cerrada sale la plantilla (WhatsApp no deja otra cosa).
-- - Si solo se eligio plantilla, sale la plantilla siempre.
-- Si no hay con que enviar, o Meta lo rechaza, queda "fallido" y avisa a quien lo programo.

create table if not exists public.mensajes_programados (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  enviar_en timestamptz not null,
  texto text check (texto is null or length(texto) between 1 and 4096),
  -- Con texto, es la plantilla de respaldo; sin texto, es lo que se envia.
  template_id uuid references public.templates(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviando', 'enviado', 'fallido', 'cancelado')),
  enviado_como text check (enviado_como in ('texto', 'plantilla')),
  error text,
  enviado_el timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (texto is not null or template_id is not null)
);

-- El trabajo de fondo solo mira los pendientes.
create index if not exists mensajes_programados_pendientes_idx
  on public.mensajes_programados (enviar_en) where estado = 'pendiente';
create index if not exists mensajes_programados_chat_idx
  on public.mensajes_programados (conversation_id, enviar_en);

alter table public.mensajes_programados enable row level security;

-- Las mismas reglas de los recordatorios (0166): en un espacio individual cada
-- quien ve los suyos; un vendedor, los suyos y los de sus chats asignados.
drop policy if exists mensajes_programados_miembros on public.mensajes_programados;
create policy mensajes_programados_miembros on public.mensajes_programados
  for all
  using (
    case
      when public.espacio_individual(workspace_id) then created_by = (select auth.uid())
      else
        public.is_platform_admin()
        or (
          public.is_workspace_member(workspace_id)
          and (not (select public.soy_vendedor()) or created_by = (select auth.uid()) or public.contacto_asignado_a_mi(contact_id))
        )
    end
  )
  with check (public.is_workspace_member(workspace_id) or public.is_platform_admin());
grant select, insert, update, delete on public.mensajes_programados to authenticated, service_role;

-- El trabajo de fondo los toma de a pocos y los marca "enviando" en el mismo
-- paso: si dos procesos corren a la vez, ninguno manda el mismo mensaje dos veces.
-- Uno que quedo "enviando" mas de 10 minutos (el proceso se cayo a mitad) se
-- marca fallido y no se reintenta: pudo haber salido.
create or replace function public.tomar_mensajes_programados(p_limite integer default 20)
returns setof public.mensajes_programados
language plpgsql
security definer
set search_path = public
as $$
begin
  update mensajes_programados set estado = 'fallido', error = 'Se interrumpió el envío. Revisa el chat antes de programarlo de nuevo.'
  where estado = 'enviando' and enviado_el < now() - interval '10 minutes';

  return query
  update mensajes_programados m set estado = 'enviando', enviado_el = now()
  where m.id in (
    select p.id from mensajes_programados p
    where p.estado = 'pendiente' and p.enviar_en <= now()
    order by p.enviar_en
    limit p_limite
    for update skip locked
  )
  returning m.*;
end;
$$;
revoke all on function public.tomar_mensajes_programados(integer) from public, anon, authenticated;
grant execute on function public.tomar_mensajes_programados(integer) to service_role;

select pg_notify('pgrst', 'reload schema');
