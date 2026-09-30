-- Modulo Flujos: conversaciones armadas en un lienzo, tipo ManyChat.
--
-- Fase 1 -- el lienzo y su contenido. El motor que mueve al contacto de
-- bloque en bloque llega despues, pero el modelo ya se deja completo para no
-- migrar dos veces: por eso existen `estado` y los campos de limites, aunque
-- todavia no haya nada que los lea.
--
-- Un flujo es un grafo: bloques (nodos) y conexiones (aristas). Se guarda tal
-- cual lo dibuja el usuario --con sus coordenadas-- porque el dibujo ES la
-- configuracion, no una vista bonita de otra cosa.

create table if not exists public.flujos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nombre text not null,
  descripcion text,
  activo boolean not null default false,
  -- Por que linea sale. Null = la principal del espacio, igual que campañas.
  whatsapp_account_id uuid references public.whatsapp_accounts (id) on delete set null,
  -- Dias que puede durar un contacto dentro del flujo antes de que se cierre
  -- solo. Sin esto, alguien que nunca responde queda "dentro" para siempre y
  -- se le apagan los seguimientos de por vida sin que nadie lo note.
  dias_de_vida smallint not null default 7,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists flujos_workspace_idx on public.flujos (workspace_id, created_at desc);

-- Como entra un contacto: los mismos disparadores de las automatizaciones,
-- mas la entrada manual. Se guardan aparte porque un flujo puede tener
-- varios ("hola" o "precio" o tocar tal boton).
create table if not exists public.flujo_disparadores (
  id uuid primary key default gen_random_uuid(),
  flujo_id uuid not null references public.flujos (id) on delete cascade,
  tipo text not null check (tipo in ('keyword', 'button_tap', 'any_message', 'first_message_of_day', 'tag', 'manual')),
  -- Que palabra, que id de boton o que etiqueta, segun el tipo.
  valor text,
  tag_id uuid references public.tags (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists flujo_disparadores_flujo_idx on public.flujo_disparadores (flujo_id);

-- Los bloques del lienzo.
--
-- `datos` es jsonb a proposito: cada tipo de bloque guarda cosas distintas
-- (un mensaje guarda texto y adjunto; unos botones guardan sus titulos; una
-- espera guarda minutos) y meter una columna por cada campo de cada tipo
-- seria una tabla de cuarenta columnas casi siempre vacias.
create table if not exists public.flujo_nodos (
  id uuid primary key default gen_random_uuid(),
  flujo_id uuid not null references public.flujos (id) on delete cascade,
  tipo text not null check (tipo in ('inicio', 'mensaje', 'botones', 'esperar', 'ia', 'fin')),
  datos jsonb not null default '{}'::jsonb,
  -- Posicion en el lienzo. Es configuracion del usuario, no decoracion.
  pos_x real not null default 0,
  pos_y real not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists flujo_nodos_flujo_idx on public.flujo_nodos (flujo_id);

-- Las conexiones. `salida` distingue de que punto del bloque sale la linea:
-- en un bloque de botones es el boton ("0", "1", "2"); en una espera es
-- "respondio" o "no_respondio"; en los demas, null.
create table if not exists public.flujo_conexiones (
  id uuid primary key default gen_random_uuid(),
  flujo_id uuid not null references public.flujos (id) on delete cascade,
  origen_id uuid not null references public.flujo_nodos (id) on delete cascade,
  destino_id uuid not null references public.flujo_nodos (id) on delete cascade,
  salida text,
  created_at timestamptz not null default now()
);

create index if not exists flujo_conexiones_flujo_idx on public.flujo_conexiones (flujo_id);
-- Una salida solo puede ir a un sitio: dos destinos para el mismo boton no es
-- un flujo, es una ambiguedad.
create unique index if not exists flujo_conexiones_salida_unica
  on public.flujo_conexiones (origen_id, coalesce(salida, ''));

alter table public.flujos enable row level security;
alter table public.flujo_disparadores enable row level security;
alter table public.flujo_nodos enable row level security;
alter table public.flujo_conexiones enable row level security;

-- Mismo patron que el resto del sistema, y con la forma rapida que dejamos en
-- la migracion 0122: el conjunto de espacios del usuario se calcula una vez
-- por consulta, no una vez por fila.
create policy flujos_all on public.flujos
for all
using (
  (select public.is_platform_admin())
  or workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
)
with check (
  (select public.is_platform_admin())
  or workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
);

create policy flujo_disparadores_all on public.flujo_disparadores
for all
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.flujos f
    where f.id = flujo_disparadores.flujo_id
      and f.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.flujos f
    where f.id = flujo_disparadores.flujo_id
      and f.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
  )
);

create policy flujo_nodos_all on public.flujo_nodos
for all
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.flujos f
    where f.id = flujo_nodos.flujo_id
      and f.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.flujos f
    where f.id = flujo_nodos.flujo_id
      and f.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
  )
);

create policy flujo_conexiones_all on public.flujo_conexiones
for all
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.flujos f
    where f.id = flujo_conexiones.flujo_id
      and f.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.flujos f
    where f.id = flujo_conexiones.flujo_id
      and f.workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid()))
  )
);

-- El modulo, para que se pueda incluir o no en cada plan desde Admin.
insert into public.modules (key, name, description)
values ('flujos', 'Flujos', 'Conversaciones armadas en un lienzo: mensajes, botones, esperas y entrega al agente de IA')
on conflict (key) do update set name = excluded.name, description = excluded.description;

select pg_notify('pgrst', 'reload schema');
