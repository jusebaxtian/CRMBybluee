-- Leads por vendedor (9 nov 2026): cuantos clientes tiene cada asesor en cada
-- etapa, y campanas para los asignados de un asesor (con o sin etapa).

-- Asesor asignado como filtro de la campana. Vacio = sin filtrar.
alter table public.campaigns add column if not exists audience_asignado_id uuid;

-- Un contacto cuenta para cada asesor que tenga asignada alguna de sus
-- conversaciones (uno por linea, 0108). null = contactos sin ningun asesor.
-- Usa los mismos filtros de la lista de Leads, salvo el de asignado.
create or replace function public.leads_por_asignado(
  p_workspace uuid, p_q text default null, p_linea uuid default null,
  p_fecha_de text default 'frio', p_desde timestamptz default null, p_hasta timestamptz default null
)
returns table(asignado uuid, etapa text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select l.contact_id, l.etapa from leads_filtrados(p_workspace, p_q, null, p_linea, p_fecha_de, p_desde, p_hasta) l
  ),
  pares as (
    select distinct f.contact_id, f.etapa, v.assigned_agent_id as asignado
    from f join conversations v on v.contact_id = f.contact_id and v.assigned_agent_id is not null
    union all
    select f.contact_id, f.etapa, null::uuid
    from f where not exists (select 1 from conversations v where v.contact_id = f.contact_id and v.assigned_agent_id is not null)
  )
  select asignado, etapa, count(*) from pares group by 1, 2;
$$;
revoke all on function public.leads_por_asignado(uuid, text, uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.leads_por_asignado(uuid, text, uuid, text, timestamptz, timestamptz) to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
