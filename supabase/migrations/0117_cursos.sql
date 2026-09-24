-- Cursos de pago dentro de Tutoriales: el admin de la plataforma publica un
-- curso (portada + precio) y sus lecciones son tutoriales marcados con
-- curso_id. El espacio paga por la pasarela (Bold) o por transferencia con
-- comprobante, y al aprobarse se le abre el acceso.

create table cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  portada_url text,
  precio_cents bigint not null default 0,
  currency text not null default 'COP',
  -- Datos para pagar por transferencia (Nequi, cuenta bancaria...).
  datos_transferencia text,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- Una leccion es un tutorial que pertenece a un curso. Sin curso_id el
-- tutorial sigue siendo gratuito y visible para todos (migracion 0116).
alter table tutoriales add column if not exists curso_id uuid references cursos (id) on delete set null;

create table curso_compras (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references cursos (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  metodo text not null check (metodo in ('bold', 'transferencia')),
  monto_cents bigint not null default 0,
  currency text not null default 'COP',
  bold_order_id text,
  proof_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  revisado_por uuid references auth.users (id),
  revisado_en timestamptz,
  created_at timestamptz not null default now()
);

create index curso_compras_workspace_idx on curso_compras (workspace_id, curso_id);
create index curso_compras_bold_idx on curso_compras (bold_order_id);

alter table cursos enable row level security;
alter table curso_compras enable row level security;

create policy "cursos_select" on cursos
  for select using (activo or is_platform_admin());

create policy "cursos_admin_write" on cursos
  for all using (is_platform_admin()) with check (is_platform_admin());

-- Cada espacio ve solo sus compras; el admin de la plataforma las ve todas.
create policy "curso_compras_select" on curso_compras
  for select using (is_workspace_member(workspace_id) or is_platform_admin());

create policy "curso_compras_insert" on curso_compras
  for insert with check (is_workspace_member(workspace_id));

create policy "curso_compras_admin_update" on curso_compras
  for update using (is_platform_admin()) with check (is_platform_admin());

-- Portadas de cursos: publicas, como el banner del dashboard.
insert into storage.buckets (id, name, public)
values ('cursos', 'cursos', true)
on conflict (id) do nothing;
