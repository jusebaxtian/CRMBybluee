-- Flujos: el bloque "Asignar a un agente" reparte de verdad, por porcentaje, y el
-- bloque "Fin" decide si el contacto puede volver a pasar por el flujo.

-- Cuantas veces mas puede volver el contacto, segun el Fin por el que salio:
-- null = sin limite (como siempre), 0 = nunca, N = N veces mas.
alter table public.flujo_ejecuciones
  add column if not exists reingresos_permitidos smallint;

-- Cuantos chats le ha entregado cada flujo a cada agente, para que el resultado
-- real se acerque al porcentaje. Va por flujo y no por bloque: guardar el lienzo
-- le cambia el id a todos los bloques y borraria la cuenta.
create table if not exists public.flujo_reparto_conteo (
  flujo_id uuid not null references public.flujos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asignados integer not null default 0,
  primary key (flujo_id, user_id)
);
alter table public.flujo_reparto_conteo enable row level security;
grant select, insert, update on public.flujo_reparto_conteo to service_role;

-- Elige al agente que mas lejos este de su porcentaje y le suma uno. Sin
-- porcentajes configurados (o si ya nadie de la lista sigue en el equipo), parejo
-- entre todos los asesores del espacio. Null si el espacio no tiene asesores.
create or replace function public.flujo_elegir_agente(p_flujo uuid, p_reparto jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_elegido uuid;
begin
  select f.workspace_id into v_workspace from flujos f where f.id = p_flujo;
  if v_workspace is null then return null; end if;

  -- Dos chats al mismo tiempo no pueden leer la misma cuenta.
  perform pg_advisory_xact_lock(hashtextextended(p_flujo::text, 170));

  with miembros as (
    select m.user_id from workspace_members m where m.workspace_id = v_workspace and m.role = 'agent'
  ),
  pedidos as (
    select (e->>'agenteId')::uuid as user_id, (e->>'porcentaje')::numeric as pct
    from jsonb_array_elements(case when jsonb_typeof(p_reparto) = 'array' then p_reparto else '[]'::jsonb end) e
  ),
  configurados as (
    select m.user_id, p.pct from miembros m join pedidos p on p.user_id = m.user_id where p.pct > 0
  ),
  candidatos as (
    select user_id, pct from configurados
    union all
    select m.user_id, 1 from miembros m where not exists (select 1 from configurados)
  ),
  con_cuenta as (
    select c.user_id, c.pct, coalesce(r.asignados, 0) as asignados
    from candidatos c
    left join flujo_reparto_conteo r on r.flujo_id = p_flujo and r.user_id = c.user_id
  )
  select x.user_id into v_elegido
  from con_cuenta x
  order by
    (x.pct / (select sum(pct) from con_cuenta)) * ((select sum(asignados) from con_cuenta) + 1) - x.asignados desc,
    random()
  limit 1;

  if v_elegido is null then return null; end if;

  insert into flujo_reparto_conteo (flujo_id, user_id, asignados)
  values (p_flujo, v_elegido, 1)
  on conflict (flujo_id, user_id) do update set asignados = flujo_reparto_conteo.asignados + 1;

  return v_elegido;
end;
$$;
revoke all on function public.flujo_elegir_agente(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.flujo_elegir_agente(uuid, jsonb) to service_role;
