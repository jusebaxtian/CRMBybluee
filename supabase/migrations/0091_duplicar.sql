-- Duplicar automatizaciones, seguimientos y respuestas rapidas.
--
-- Automatizaciones y seguimientos son la misma tabla (`automations`; un
-- seguimiento es trigger_type = 'no_reply'), asi que una funcion cubre las
-- dos. Las respuestas rapidas tienen su propia pareja de tablas.
--
-- Se copia con to_jsonb/jsonb_populate_record y no enumerando columnas: si
-- mañana se añade una columna, la copia la incluye sola. Enumerarlas es
-- garantizar que la proxima columna nueva se quede fuera del duplicado sin
-- que nadie lo note.
--
-- SECURITY INVOKER (el valor por defecto) a proposito: corre con los permisos
-- de quien llama, asi que RLS impide duplicar algo de otro espacio. La fila
-- origen tiene que ser visible para el usuario, y la nueva se inserta con su
-- mismo workspace_id, que RLS tambien comprueba.
--
-- La copia nace DESACTIVADA. Dos automatizaciones activas con la misma
-- palabra clave dispararian las dos, y una copia se hace para editarla antes
-- de usarla, no para tener dos iguales corriendo.

create or replace function duplicar_automatizacion(p_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_nuevo uuid := gen_random_uuid();
  v_fila jsonb;
  v_accion record;
begin
  select to_jsonb(a) into v_fila from automations a where a.id = p_id;
  if v_fila is null then
    raise exception 'Automatizacion no encontrada' using errcode = 'P0002';
  end if;

  v_fila := v_fila
    || jsonb_build_object(
         'id', v_nuevo,
         'name', (v_fila->>'name') || ' (copia)',
         'is_active', false,
         'disabled_by_ai', false,
         'created_at', now()
       );

  insert into automations select * from jsonb_populate_record(null::automations, v_fila);

  for v_accion in
    select to_jsonb(x) as fila from automation_actions x where x.automation_id = p_id order by x.position
  loop
    insert into automation_actions
      select * from jsonb_populate_record(
        null::automation_actions,
        v_accion.fila || jsonb_build_object('id', gen_random_uuid(), 'automation_id', v_nuevo)
      );
  end loop;

  return v_nuevo;
end;
$$;

create or replace function duplicar_respuesta_rapida(p_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_nuevo uuid := gen_random_uuid();
  v_fila jsonb;
  v_accion record;
begin
  select to_jsonb(q) into v_fila from quick_replies q where q.id = p_id;
  if v_fila is null then
    raise exception 'Respuesta rapida no encontrada' using errcode = 'P0002';
  end if;

  v_fila := v_fila
    || jsonb_build_object(
         'id', v_nuevo,
         'name', (v_fila->>'name') || ' (copia)',
         'is_active', false,
         'created_at', now()
       );

  insert into quick_replies select * from jsonb_populate_record(null::quick_replies, v_fila);

  for v_accion in
    select to_jsonb(x) as fila from quick_reply_actions x where x.quick_reply_id = p_id order by x.position
  loop
    insert into quick_reply_actions
      select * from jsonb_populate_record(
        null::quick_reply_actions,
        v_accion.fila || jsonb_build_object('id', gen_random_uuid(), 'quick_reply_id', v_nuevo)
      );
  end loop;

  return v_nuevo;
end;
$$;

select pg_notify('pgrst', 'reload schema');
