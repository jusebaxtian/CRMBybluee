-- Los secretos dejan de estar en texto plano.
--
-- Hoy `whatsapp_accounts.access_token` y `ai_agents.api_key` se guardan tal
-- cual. Medido el 11 de septiembre de 2026: 12 tokens de Meta, 6 claves de IA
-- y 1 token de plataforma, y el ultimo respaldo nocturno tenia 2.646 lineas
-- con tokens legibles. Quien consiga una copia de la base puede enviar
-- WhatsApp haciendose pasar por cualquiera de tus clientes y gastar sus
-- creditos de OpenAI o Anthropic.
--
-- Se usa supabase_vault, que ya estaba instalado. Guarda el secreto cifrado y
-- la llave raiz vive en /etc/postgresql-custom/pgsodium_root.key, FUERA de la
-- base: un pg_dump se lleva el texto cifrado y no la llave.
--
-- OJO OPERATIVO: por lo mismo, restaurar un respaldo en una maquina nueva sin
-- esa llave deja los secretos irrecuperables. El fichero debe respaldarse
-- aparte y en otro sitio; el cron de /opt/backups/backup-db.sh NO lo incluye.

-- Referencia al secreto guardado en el vault. Convive con la columna en texto
-- plano durante la transicion: primero se escribe en los dos sitios, luego se
-- vacia el texto plano. Migrar y borrar en el mismo paso deja sin vuelta atras
-- si algo sale mal.
alter table whatsapp_accounts add column if not exists access_token_secret_id uuid;
alter table ai_agents add column if not exists api_key_secret_id uuid;
alter table platform_whatsapp_account add column if not exists access_token_secret_id uuid;

-- Mueve un texto al vault y devuelve su identificador. Si ya habia uno, lo
-- reemplaza en vez de dejar secretos sueltos acumulandose.
create or replace function guardar_secreto(
  p_valor text,
  p_nombre text,
  p_anterior uuid default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'vault'
as $$
declare
  v_id uuid;
begin
  if p_valor is null or p_valor = '' then
    return null;
  end if;

  if p_anterior is not null then
    delete from vault.secrets where id = p_anterior;
  end if;

  -- El nombre lleva un sufijo aleatorio porque vault.secrets exige nombre
  -- unico y un mismo espacio puede reconectar su numero varias veces.
  select vault.create_secret(p_valor, p_nombre || '-' || gen_random_uuid()::text, p_nombre)
    into v_id;
  return v_id;
end;
$$;

-- Lee un secreto. Devuelve null si el identificador no existe: quien llama
-- debe tratar eso como "no hay token", nunca como cadena vacia.
create or replace function leer_secreto(p_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'vault'
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

-- Nadie que no sea la clave de servicio debe poder leer secretos.
revoke all on function leer_secreto(uuid) from public, anon, authenticated;
revoke all on function guardar_secreto(text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Traslado de lo que ya existe
-- ---------------------------------------------------------------------------
do $$
declare
  fila record;
begin
  for fila in select id, access_token from whatsapp_accounts
              where access_token is not null and access_token <> ''
                and access_token_secret_id is null loop
    update whatsapp_accounts
      set access_token_secret_id = guardar_secreto(fila.access_token, 'whatsapp-' || fila.id::text)
      where id = fila.id;
  end loop;

  -- ai_agents se identifica por workspace_id: no tiene columna id.
  for fila in select workspace_id, api_key from ai_agents
              where api_key is not null and api_key <> ''
                and api_key_secret_id is null loop
    update ai_agents
      set api_key_secret_id = guardar_secreto(fila.api_key, 'ia-' || fila.workspace_id::text)
      where workspace_id = fila.workspace_id;
  end loop;

  for fila in select id, access_token from platform_whatsapp_account
              where access_token is not null and access_token <> ''
                and access_token_secret_id is null loop
    update platform_whatsapp_account
      set access_token_secret_id = guardar_secreto(fila.access_token, 'plataforma-' || fila.id::text)
      where id = fila.id;
  end loop;
end $$;

select pg_notify('pgrst', 'reload schema');
