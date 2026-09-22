-- Tutoriales en video de la plataforma. Los administra el admin de la
-- plataforma; todo espacio los ve en el menu "Tutoriales". No se suben
-- videos al servidor: solo enlaces (YouTube se reproduce embebido, otras
-- URLs abren en pestana nueva).
create table tutoriales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  url text not null,
  modulo text not null default 'empezar'
    check (modulo in ('empezar', 'conversaciones', 'contactos', 'campanas', 'automatizaciones', 'agente_ia', 'agenda', 'configuracion', 'otros')),
  duracion text,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tutoriales enable row level security;

create policy "tutoriales_select" on tutoriales
  for select using (activo or is_platform_admin());

create policy "tutoriales_admin_write" on tutoriales
  for all using (is_platform_admin()) with check (is_platform_admin());
