-- Agente vendedor (Juanes): atiende todos los chats del espacio de Bybluee, aparte
-- de los agentes por linea del modulo Agente de IA. Se enciende desde el panel de
-- admin. Usa la llave de IA ya conectada en el espacio, por eso aqui no se guarda.
create table if not exists public.agente_vendedor (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  nombre text not null default 'Juanes',
  activo boolean not null default false,
  instrucciones text not null default '',
  actualizado_el timestamptz not null default now()
);

alter table public.agente_vendedor enable row level security;
drop policy if exists agente_vendedor_admin on public.agente_vendedor;
create policy agente_vendedor_admin on public.agente_vendedor
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update on public.agente_vendedor to authenticated, service_role;

-- El espacio que compro este contacto, para que el agente lo conozca. La misma
-- busqueda de admin_espacio_de_contacto, sin sesion: la usa el proceso del webhook.
create or replace function public.espacios_del_contacto(p_contact_id uuid)
returns table(workspace_name text, status text, plan_name text, vence timestamptz, lineas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select w.name, w.status, p.name,
    coalesce(
      (select s.current_period_end from subscriptions s
        where s.workspace_id = w.id and s.status = 'active'
        order by s.current_period_end desc limit 1),
      w.trial_ends_at),
    (select count(*) from whatsapp_accounts a where a.workspace_id = w.id and a.status <> 'frozen')
  from contacts c
  join workspaces w
    on w.cliente_contact_id = c.id
    or (w.cliente_contact_id is null and admin_telefono_normalizado(w.phone) = c.wa_id)
  left join plans p on p.id = w.plan_id
  where c.id = p_contact_id
  order by (w.cliente_contact_id = c.id) desc, w.created_at desc
  limit 5;
$$;
revoke all on function public.espacios_del_contacto(uuid) from public, anon, authenticated;
grant execute on function public.espacios_del_contacto(uuid) to service_role;

-- Arranca APAGADO, con las instrucciones que ya tenia el agente de la linea de Ventas.
insert into public.agente_vendedor (workspace_id, nombre, activo, instrucciones)
select '3e4ff27d-50e9-484d-a5cb-e11bd1b5ae5f', 'Juanes', false,
  coalesce((select a.persona from public.ai_agents a where a.whatsapp_account_id = '33d0d1a3-bfab-434c-81f4-9d3af7053147'), '')
on conflict (workspace_id) do nothing;

select pg_notify('pgrst', 'reload schema');
