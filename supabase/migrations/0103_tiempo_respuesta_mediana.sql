-- Tiempo de respuesta del dashboard: MEDIANA en vez de promedio.
--
-- El promedio lo disparaban unos pocos chats retomados dias despues (un
-- mensaje respondido a los 6 dias pesaba 300 horas); la mediana refleja lo
-- tipico (decision del 14 sep 2026: mediana 2 min vs. promedio 1 h 35 en el
-- espacio del administrador). Misma firma y mismos nombres de columna, asi
-- que la app no cambia.

create or replace function dashboard_tiempo_respuesta(
  p_workspace_id uuid,
  p_desde timestamptz,
  p_corte timestamptz,
  p_hasta timestamptz
)
returns table (actual_seg numeric, anterior_seg numeric)
language sql
stable
security definer
set search_path to 'public'
as $$
  with entrantes as (
    select m.id, m.conversation_id, m.created_at
    from messages m
    join conversations c on c.id = m.conversation_id
    where c.workspace_id = p_workspace_id
      and is_workspace_member(p_workspace_id)
      and m.direction = 'in'
      and m.created_at >= p_desde and m.created_at <= p_hasta
  ),
  respuestas as (
    select e.created_at as entrante, sal.created_at as salida
    from entrantes e
    left join lateral (
      select s.created_at from messages s
      where s.conversation_id = e.conversation_id
        and s.direction = 'out'
        and s.created_at > e.created_at
      order by s.created_at asc
      limit 1
    ) sal on true
  )
  select
    (percentile_cont(0.5) within group (order by extract(epoch from (salida - entrante)))
      filter (where entrante >= p_corte))::numeric as actual_seg,
    (percentile_cont(0.5) within group (order by extract(epoch from (salida - entrante)))
      filter (where entrante <  p_corte))::numeric as anterior_seg
  from respuestas
  where salida is not null;
$$;
