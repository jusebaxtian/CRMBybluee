-- Coexistencia: el mismo numero en la app WhatsApp Business y en la API.
--
-- `connection_mode`: 'api' es la conexion de siempre (numero solo en la API);
-- 'coexistencia' es un numero que tambien sigue vivo en la app del celular.
-- `coex_sync` guarda el avance de la sincronizacion inicial que Meta exige
-- hacer en las primeras 24 horas (contactos e historial).
-- `messages.sent_from_app`: mensajes que la persona escribio desde el celular
-- (llegan por el aviso "smb_message_echoes") o que vienen del historial.

alter table public.whatsapp_accounts
  add column if not exists connection_mode text not null default 'api',
  add column if not exists coex_onboarded_at timestamptz,
  add column if not exists coex_sync jsonb;

alter table public.whatsapp_accounts drop constraint if exists whatsapp_accounts_connection_mode_check;
alter table public.whatsapp_accounts
  add constraint whatsapp_accounts_connection_mode_check check (connection_mode in ('api', 'coexistencia'));

alter table public.messages
  add column if not exists sent_from_app boolean not null default false;

notify pgrst, 'reload schema';
