-- Recuperacion de contraseña por WhatsApp, solo para el dueño del espacio.
--
-- La plataforma no tiene SMTP (ver RECUPERACION_POR_CORREO, 14 sep 2026), asi
-- que hasta hoy el cliente que olvidaba la clave tenia que escribir a soporte
-- para que un administrador se la cambiara a mano. El codigo va por WhatsApp
-- al telefono del espacio, que es el que ya esta verificado: 58 de los 59
-- espacios de produccion lo tienen.
--
-- La contraseña nueva NO se escribe en el chat: el chat solo entrega el
-- codigo, y la clave se escribe en /restablecer. Un mensaje de WhatsApp queda
-- guardado en la base del CRM y en el telefono de la persona; una contraseña
-- no puede vivir ahi.
create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null,
  -- A quien se le mando, tal como estaba en el momento de pedirlo: si luego
  -- cambia el telefono del espacio, el codigo viejo sigue atado al de antes.
  phone_e164 text not null,
  -- Solo el hash: si alguien lee la tabla no puede usar los codigos vigentes.
  code_hash text not null,
  expires_at timestamptz not null,
  -- Intentos fallidos de este codigo. A los 5 deja de servir aunque no haya
  -- caducado, para que no se pueda adivinar por fuerza bruta (un codigo de 6
  -- digitos son un millon de combinaciones, pero sin tope se prueban rapido).
  attempts smallint not null default 0,
  -- Cuando se uso. Un codigo usado no vuelve a servir.
  consumed_at timestamptz,
  -- Se llena al verificar el codigo y es lo que autoriza a cambiar la clave en
  -- /restablecer. Asi el formulario de contraseña nueva no necesita volver a
  -- pedir el codigo ni dejarlo en la URL.
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Para el limite de "un codigo por minuto" y para buscar el vigente.
create index if not exists password_reset_codes_phone_idx
  on public.password_reset_codes (phone_e164, created_at desc);

create index if not exists password_reset_codes_token_idx
  on public.password_reset_codes (reset_token_hash)
  where reset_token_hash is not null;

-- Nadie: la tabla se usa solo desde el servidor con la llave de servicio. El
-- que pide el codigo todavia no ha iniciado sesion, asi que no hay sesion que
-- pudiera darle permiso — dejar RLS activo sin politicas es justo lo correcto.
alter table public.password_reset_codes enable row level security;

select pg_notify('pgrst', 'reload schema');
