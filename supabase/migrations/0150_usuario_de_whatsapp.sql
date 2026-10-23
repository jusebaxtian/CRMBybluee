-- Nombre de usuario de WhatsApp (@usuario) de los contactos que escriben sin numero.
--
-- Meta entrega a esos contactos solo un identificador (el BSUID, "CO.123...", que
-- ya se guarda en contacts.bsuid) y su nombre de perfil. Si ademas manda el nombre
-- de usuario, aqui queda guardado. Todo es aditivo y nullable: nada de lo que ya
-- funciona (envios masivos, campañas, busquedas) lee esta columna.
begin;

alter table public.contacts add column username text;

-- Muestras (pocas y sin texto de mensajes) de lo que Meta manda para contactos sin
-- numero, para comprobar en que campo llega el nombre de usuario. Solo el servidor
-- escribe y lee: no hay politicas, asi que el navegador no tiene acceso.
create table public.muestras_webhook_usuarios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  contacto jsonb,
  mensaje jsonb
);

alter table public.muestras_webhook_usuarios enable row level security;

commit;
