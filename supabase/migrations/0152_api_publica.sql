-- API publica (fase 1): el modulo de pago y las llaves de acceso.
--
-- Cada espacio crea sus llaves; en la base solo queda la HUELLA (sha256) de la
-- llave, nunca la llave: se muestra una sola vez al crearla. Las tablas no se
-- pueden leer ni escribir desde el navegador: todo pasa por el servidor, que
-- antes comprueba el rol (dueño o administrador) y el modulo del plan.
begin;

insert into modules (key, name, description) values
  ('api_publica', 'API e integraciones', 'Llaves de API, webhooks y documentacion para conectar el CRM con aplicaciones de terceros')
on conflict (key) do nothing;

create table public.api_llaves (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  -- Primeros caracteres de la llave, para reconocerla en la lista ("bbl_live_ab12").
  prefijo text not null,
  huella text not null unique,
  permisos text[] not null default '{}',
  creada_por uuid references auth.users (id) on delete set null,
  vence_el timestamptz,
  revocada_el timestamptz,
  ultimo_uso_el timestamptz,
  created_at timestamptz not null default now()
);

create index api_llaves_workspace_idx on public.api_llaves (workspace_id);

-- Tope de peticiones por minuto de cada espacio; sin fila, el valor por defecto (60).
create table public.api_ajustes (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  limite_por_minuto integer not null default 60 check (limite_por_minuto between 1 and 6000),
  updated_at timestamptz not null default now()
);

-- Registro de llamadas: quien, cuando y que paso. Sin cuerpos ni datos de clientes.
create table public.api_uso (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  llave_id uuid references public.api_llaves (id) on delete set null,
  metodo text not null,
  ruta text not null,
  estado integer not null,
  ms integer,
  created_at timestamptz not null default now()
);

create index api_uso_workspace_idx on public.api_uso (workspace_id, created_at desc);
create index api_uso_fecha_idx on public.api_uso (created_at);

alter table public.api_llaves enable row level security;
alter table public.api_ajustes enable row level security;
alter table public.api_uso enable row level security;

revoke all on public.api_llaves from anon, authenticated;
revoke all on public.api_ajustes from anon, authenticated;
revoke all on public.api_uso from anon, authenticated;

commit;
