-- Recuperar contraseña por WhatsApp (la plataforma no tiene SMTP).
--
-- El cliente escribe su correo; el sistema busca el WhatsApp con el que se
-- registro su espacio, le manda un codigo de 6 digitos con la plantilla de
-- autenticacion de la cuenta de administracion y, con el codigo, cambia la
-- contraseña. Solo la clave de servicio toca esta tabla (sin politicas RLS
-- para usuarios): el navegador nunca ve el hash ni el telefono completo.

begin;

create table if not exists codigos_recuperacion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo_hash text not null,
  expira_en timestamptz not null,
  intentos int not null default 0,
  usado_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists codigos_recuperacion_user_idx on codigos_recuperacion (user_id, created_at desc);

alter table codigos_recuperacion enable row level security;
-- Sin politicas: solo service_role (que salta RLS) lee y escribe.

-- Correo -> usuario y WhatsApp de su espacio. SECURITY DEFINER porque lee
-- auth.users; se revoca a todos y solo se concede a service_role, asi que
-- desde el navegador no se puede usar para averiguar que correos existen.
create or replace function recuperacion_datos_por_correo(p_email text)
returns table (user_id uuid, phone text)
language sql
security definer
set search_path = public
as $$
  select u.id, w.phone
  from auth.users u
  join workspace_members m on m.user_id = u.id
  join workspaces w on w.id = m.workspace_id
  where lower(u.email) = lower(p_email)
    and w.phone is not null
  order by (m.role = 'owner') desc, m.created_at
  limit 1;
$$;

revoke all on function recuperacion_datos_por_correo(text) from public;
revoke all on function recuperacion_datos_por_correo(text) from anon, authenticated;
grant execute on function recuperacion_datos_por_correo(text) to service_role;

-- Nombre de la plantilla de autenticacion (categoria AUTHENTICATION en Meta).
insert into platform_settings (key, value)
values ('plantilla_recuperacion', 'codigo_recuperacion')
on conflict (key) do nothing;

commit;
