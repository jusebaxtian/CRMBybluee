-- Registro rediseñado: el WhatsApp del cliente se captura con selector de
-- pais y se guarda en formato internacional.
--
-- workspaces.phone sigue siendo la columna que usan el admin, la plantilla
-- de activacion y el cruce con el chat del administrador; desde ahora guarda
-- SIEMPRE los digitos con indicativo (573001234567), que es lo que WhatsApp
-- espera. Las dos columnas nuevas dejan el desglose listo para integraciones:
--   phone_country_code  '+57'
--   phone_e164          '+573001234567'
-- Las filas viejas (10 digitos sin indicativo, todas colombianas) se
-- completan con el mismo criterio que ya usaba normalizeWaId en la app.

begin;

alter table workspaces
  add column if not exists phone_country_code text,
  add column if not exists phone_e164 text;

comment on column workspaces.phone is 'WhatsApp del cliente: solo digitos, con indicativo (573001234567).';
comment on column workspaces.phone_country_code is 'Indicativo elegido en el registro, con + (+57).';
comment on column workspaces.phone_e164 is 'WhatsApp del cliente en E.164 (+573001234567).';

update workspaces
set phone = admin_telefono_normalizado(phone),
    phone_country_code = coalesce(phone_country_code, '+57'),
    phone_e164 = coalesce(phone_e164, '+' || admin_telefono_normalizado(phone))
where phone is not null
  and admin_telefono_normalizado(phone) is not null
  and (phone_e164 is null or length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10);

-- Misma funcion de siempre con dos parametros opcionales al final: el
-- registro con Google (completar-registro) y el manual la llaman igual.
create or replace function create_workspace_with_owner(
  workspace_name text,
  signup_ip text default null,
  phone text default null,
  phone_country_code text default null,
  phone_e164 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  starter_plan_id uuid;
begin
  select id into starter_plan_id from plans where name = 'Starter' limit 1;

  insert into workspaces (name, plan_id, signup_ip, phone, phone_country_code, phone_e164, status)
  values (workspace_name, starter_plan_id, signup_ip, phone, phone_country_code, phone_e164, 'past_due')
  returning id into new_workspace_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  insert into tags (workspace_id, name, color, excludes_followups)
  values (new_workspace_id, 'No seguimientos', '#ef4444', true);

  return new_workspace_id;
end;
$$;

-- Las firmas viejas (0002, 0052 y la intermedia) quedan cubiertas por los
-- valores por defecto; se eliminan para que PostgREST no tenga ambiguedad
-- al resolver la llamada por nombre de parametros.
drop function if exists create_workspace_with_owner(text);
drop function if exists create_workspace_with_owner(text, text);
drop function if exists create_workspace_with_owner(text, text, text);

commit;
