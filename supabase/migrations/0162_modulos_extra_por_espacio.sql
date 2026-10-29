-- Modulos extra por espacio: el administrador de la plataforma le habilita a
-- UN cliente un modulo que su plan no trae (primero: API y webhooks,
-- `api_publica`), desde Admin → espacio del cliente. Se suma a los del plan.
--
-- Va en tabla aparte y no como columna de `workspaces` porque los miembros
-- del espacio pueden editar su fila de workspaces: asi un cliente no puede
-- habilitarse un modulo solo. Aqui solo escribe el servidor (cliente de servicio).

create table if not exists public.workspace_modulos_extra (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  module_key text not null references public.modules(key) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, module_key)
);

alter table public.workspace_modulos_extra enable row level security;

drop policy if exists workspace_modulos_extra_select on public.workspace_modulos_extra;
create policy workspace_modulos_extra_select on public.workspace_modulos_extra
  for select using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

select pg_notify('pgrst', 'reload schema');
