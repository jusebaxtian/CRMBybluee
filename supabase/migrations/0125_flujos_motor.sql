-- El motor de Flujos: donde va cada contacto y que tiene pendiente.
--
-- Dos tablas y una idea: `flujo_ejecuciones` es "este contacto esta en este
-- bloque de este flujo", y `flujo_esperas` es "a esta hora hay que hacer algo
-- con esta ejecucion". Los tiempos viven en la base y no en memoria a
-- proposito: un reinicio del servidor no puede perder los flujos a medias de
-- cientos de contactos.

create table if not exists public.flujo_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  flujo_id uuid not null references public.flujos (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  -- En que bloque esta parado ahora mismo.
  nodo_id uuid references public.flujo_nodos (id) on delete set null,
  -- 'corriendo'  = avanzando bloque a bloque
  -- 'esperando'  = parado en un bloque de espera o de botones
  -- 'terminado'  = llego a un fin
  -- 'entregado'  = termino entregando el chat a la IA
  -- 'vencido'    = se acabaron sus dias y se cerro solo
  -- 'cancelado'  = alguien lo saco, o se desactivo el flujo
  estado text not null default 'corriendo'
    check (estado in ('corriendo', 'esperando', 'terminado', 'entregado', 'vencido', 'cancelado')),
  -- Cuantos bloques lleva recorridos. Es el corta-circuitos contra los flujos
  -- dibujados en circulo: sin esto, un lazo manda mensajes sin parar y quema
  -- el numero del cliente.
  pasos smallint not null default 0,
  -- Cuando deja de tener sentido seguir esperando a esta persona.
  vence_el timestamptz not null,
  iniciado_el timestamptz not null default now(),
  terminado_el timestamptz,
  actualizado_el timestamptz not null default now()
);

-- Un contacto no puede estar dos veces dentro del mismo flujo a la vez: sin
-- esto, dos mensajes seguidos que cumplan el disparador arrancan dos copias y
-- el cliente recibe todo duplicado.
create unique index if not exists flujo_ejecuciones_una_activa
  on public.flujo_ejecuciones (flujo_id, contact_id)
  where estado in ('corriendo', 'esperando');

-- Para preguntar rapido "¿este contacto esta dentro de algun flujo?", que es
-- lo que consultaran las automatizaciones, los seguimientos y la IA antes de
-- meterse a responder.
create index if not exists flujo_ejecuciones_contacto_activo
  on public.flujo_ejecuciones (contact_id)
  where estado in ('corriendo', 'esperando');

create index if not exists flujo_ejecuciones_flujo_idx
  on public.flujo_ejecuciones (flujo_id, iniciado_el desc);

create table if not exists public.flujo_esperas (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.flujo_ejecuciones (id) on delete cascade,
  -- Bloque que quedo esperando: al vencer, se sigue por su salida
  -- "no_respondio".
  nodo_id uuid not null references public.flujo_nodos (id) on delete cascade,
  vence_el timestamptz not null,
  -- Se marca al procesarla para no volver a dispararla.
  procesada_el timestamptz,
  created_at timestamptz not null default now()
);

-- El trabajador pregunta cada minuto "¿que vencio ya?": este indice es esa
-- pregunta.
create index if not exists flujo_esperas_pendientes
  on public.flujo_esperas (vence_el)
  where procesada_el is null;

-- Una ejecucion espera una cosa a la vez.
create unique index if not exists flujo_esperas_una_por_ejecucion
  on public.flujo_esperas (ejecucion_id)
  where procesada_el is null;

alter table public.flujo_ejecuciones enable row level security;
alter table public.flujo_esperas enable row level security;

-- Solo lectura para el equipo del espacio: quien escribe es el motor, con la
-- llave de servicio. Asi nadie puede mover a un contacto de bloque desde el
-- navegador.
create policy flujo_ejecuciones_select on public.flujo_ejecuciones
for select
using (
  (select public.is_platform_admin())
  or workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
);

create policy flujo_esperas_select on public.flujo_esperas
for select
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.flujo_ejecuciones e
    where e.id = flujo_esperas.ejecucion_id
      and e.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
  )
);

select pg_notify('pgrst', 'reload schema');
