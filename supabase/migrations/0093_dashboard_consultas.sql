-- Tres consultas de solo lectura para el dashboard del cliente.
--
-- Son agregaciones (medias, conteos por direccion, agrupado por dia) que
-- PostgREST no sabe hacer: la alternativa era bajarse todos los mensajes del
-- periodo al servidor y contarlos en JavaScript, que en el espacio grande son
-- decenas de miles de filas por carga de pantalla.
--
-- Las tres son SECURITY DEFINER, como inbox_page. La primera version era
-- SECURITY INVOKER "para que RLS protegiera", y RLS protegia evaluando su
-- politica por cada uno de los 37.970 mensajes: dashboard_mensajes tardaba
-- 126 ms como superusuario y se caia por timeout a traves de PostgREST.
--
-- La proteccion de inquilino se hace a mano y explicita: cada funcion
-- comprueba con is_workspace_member() que quien llama pertenece al espacio
-- que pide, y si no, devuelve vacio. Es la misma funcion que usan las
-- politicas RLS.
--
-- Cada una devuelve el periodo actual Y el anterior en una sola pasada, para
-- que los deltas ("+21%") no cuesten una segunda consulta.

-- Media de segundos entre un mensaje entrante y la siguiente respuesta
-- saliente de la misma conversacion.
create or replace function dashboard_tiempo_respuesta(
  p_workspace_id uuid,
  p_desde timestamptz,   -- inicio del periodo anterior
  p_corte timestamptz,   -- inicio del periodo actual
  p_hasta timestamptz    -- fin del periodo actual
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
  -- Union lateral en vez de subconsulta correlacionada: usa el indice
  -- messages (conversation_id, created_at) para saltar directo a la primera
  -- salida posterior. Medido en staging: 615 ms -> 51 ms, mismo resultado.
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
    avg(extract(epoch from (salida - entrante))) filter (where entrante >= p_corte) as actual_seg,
    avg(extract(epoch from (salida - entrante))) filter (where entrante <  p_corte) as anterior_seg
  from respuestas
  where salida is not null;
$$;

-- Mensajes enviados y recibidos, periodo actual y anterior.
create or replace function dashboard_mensajes(
  p_workspace_id uuid,
  p_desde timestamptz,
  p_corte timestamptz,
  p_hasta timestamptz
)
returns table (
  enviados_actual bigint, recibidos_actual bigint,
  enviados_anterior bigint, recibidos_anterior bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    count(*) filter (where m.direction = 'out' and m.created_at >= p_corte),
    count(*) filter (where m.direction = 'in'  and m.created_at >= p_corte),
    count(*) filter (where m.direction = 'out' and m.created_at <  p_corte),
    count(*) filter (where m.direction = 'in'  and m.created_at <  p_corte)
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.workspace_id = p_workspace_id
    and is_workspace_member(p_workspace_id)
    and m.created_at >= p_desde and m.created_at <= p_hasta;
$$;

-- Contactos nuevos por dia, y cuantos de ellos llegaron desde un anuncio.
-- El dia se corta en hora de Colombia, que es donde estan los clientes.
create or replace function dashboard_leads_por_dia(
  p_workspace_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz
)
returns table (dia date, nuevos bigint, meta_ads bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (ct.created_at at time zone 'America/Bogota')::date as dia,
    count(*) as nuevos,
    count(*) filter (where exists (
      select 1 from conversations cv
      where cv.contact_id = ct.id and cv.ad_source_id is not null
    )) as meta_ads
  from contacts ct
  where ct.workspace_id = p_workspace_id
    and is_workspace_member(p_workspace_id)
    and ct.created_at >= p_desde and ct.created_at <= p_hasta
  group by 1
  order by 1;
$$;

select pg_notify('pgrst', 'reload schema');
