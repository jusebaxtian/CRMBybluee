-- Dos decisiones de Sebastian del 11 de septiembre de 2026:
--   1. Los registros de pago se conservan siempre: son su contabilidad.
--   2. Es ENCARGADO de los datos de los contactos, no responsable.
--
-- La primera exige romper una cascada. La segunda exige poder demostrar que
-- se ejecuto lo que un cliente pidio.

-- ---------------------------------------------------------------------------
-- 1. Los pagos sobreviven al borrado del espacio
-- ---------------------------------------------------------------------------
--
-- `payments.workspace_id` era NOT NULL con ON DELETE CASCADE: borrar un
-- espacio destruia su historial de pagos. Con "siempre se conservan" eso es
-- justo lo contrario de lo que debe pasar.
--
-- Ahora la referencia se pone en null y la fila queda. Para que siga
-- sirviendo cuando el espacio ya no exista se copian el nombre y el telefono
-- del negocio: sin ellos, un pago huerfano es una cifra sin dueño. No hay NIT
-- en `workspaces`, asi que se conserva lo que hay.
alter table payments
  add column if not exists workspace_name text,
  add column if not exists workspace_phone text;

-- Relleno de los pagos que ya existen, mientras su espacio sigue vivo.
update payments p
set workspace_name = w.name,
    workspace_phone = w.phone
from workspaces w
where w.id = p.workspace_id and p.workspace_name is null;

alter table payments alter column workspace_id drop not null;

-- Reejecutable: se recrea solo si todavia esta en cascada. Sin esta guarda,
-- volver a aplicar la migracion falla al añadir una restriccion que ya existe
-- y aborta el resto del fichero.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'payments_workspace_id_fkey' and confdeltype <> 'n'
  ) or not exists (
    select 1 from pg_constraint where conname = 'payments_workspace_id_fkey'
  ) then
    alter table payments drop constraint if exists payments_workspace_id_fkey;
    alter table payments
      add constraint payments_workspace_id_fkey
      foreign key (workspace_id) references workspaces (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Registro de borrados
-- ---------------------------------------------------------------------------
--
-- La pagina /eliminar-datos promete atender una solicitud "en un plazo maximo
-- de 30 dias". Hoy el borrado es manual por correo y no queda constancia de
-- cuando entro la solicitud ni de cuando se ejecuto: cumplir y no poder
-- probarlo se parece demasiado a no cumplir.
--
-- Siendo encargado, la solicitud del contacto la recibe el negocio y llega
-- aqui a traves del cliente. Por eso se guarda tanto quien pidio como por que
-- via.
--
-- A PROPOSITO sin clave foranea a `workspaces`: esta fila tiene que sobrevivir
-- al borrado del espacio, que es precisamente lo que documenta. Guarda
-- identificadores y cifras, nunca el dato borrado.
create table if not exists data_deletion_log (
  id uuid primary key default gen_random_uuid(),

  -- Que se borro: un espacio entero, un contacto, una conversacion, o una
  -- pasada de la politica de retencion.
  scope text not null check (scope in ('workspace', 'contact', 'conversation', 'retention')),

  workspace_id uuid,
  workspace_name text,
  -- Identificador de lo borrado cuando no es el espacio entero.
  target_ref text,

  -- Cuando entro la solicitud y por donde. Null cuando lo dispara la politica
  -- de retencion y no una persona.
  requested_at timestamptz,
  requested_via text,

  executed_at timestamptz not null default now(),
  executed_by uuid,

  -- Resumen de lo eliminado: {"contacts": 120, "messages": 4300}. Cifras, no
  -- contenido.
  rows_deleted jsonb,
  files_deleted integer not null default 0,
  notes text
);

create index if not exists data_deletion_log_workspace_idx
  on data_deletion_log (workspace_id, executed_at desc);

alter table data_deletion_log enable row level security;

-- Solo los administradores de plataforma lo leen. No lleva politica de
-- escritura: se escribe con la clave de servicio desde el propio borrado.
drop policy if exists "data_deletion_log_admin_select" on data_deletion_log;
create policy "data_deletion_log_admin_select" on data_deletion_log
  for select using (is_platform_admin());

select pg_notify('pgrst', 'reload schema');

-- El nombre del negocio se copia en la base, no en la aplicacion.
--
-- Hay dos sitios que insertan pagos (Bold y transferencia manual) y mañana
-- puede haber un tercero. Si cada uno tuviera que acordarse de copiar el
-- nombre, tarde o temprano uno no lo haria y ese pago quedaria sin dueño
-- justo cuando hiciera falta: despues de borrar el espacio.
create or replace function rellenar_negocio_en_pago() returns trigger as $$
begin
  if new.workspace_name is null and new.workspace_id is not null then
    select w.name, w.phone into new.workspace_name, new.workspace_phone
    from workspaces w where w.id = new.workspace_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists payments_rellenar_negocio on payments;
create trigger payments_rellenar_negocio
  before insert on payments
  for each row execute function rellenar_negocio_en_pago();

select pg_notify('pgrst', 'reload schema');
