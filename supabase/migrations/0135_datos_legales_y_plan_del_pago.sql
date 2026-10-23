-- Datos legales de la empresa (bloqueados una vez registrados) y plan de cada pago.
--
-- 1) Datos legales. Se suman a las columnas de 0134: la razon social con la que
--    se emiten los soportes, y la marca de cuando se registraron. Esa marca es el
--    candado: con ella puesta, el cliente ya no puede cambiar ninguno de los
--    cuatro datos.
--
--    El candado vive aqui, en la base, y no solo en la pantalla. La politica de
--    actualizacion de `workspaces` deja a cualquier miembro escribir su propio
--    espacio por la API publica, asi que un boton deshabilitado no impide nada:
--    bastaria llamar a la API. El disparador rechaza cualquier cambio de estas
--    columnas hecho con una sesion de cliente. Lo pueden escribir el servidor de
--    la aplicacion (rol de servicio, que es como se hace el primer registro,
--    validado y limitado al dueño) y un administrador de la plataforma.
--
-- 2) Plan del pago. Hasta ahora un pago no decia de que plan era: se cobraba el
--    plan que el espacio tuviera puesto en ese momento. Para que un cliente
--    activo pueda subir de nivel sin recibir el plan antes de pagar, el pago
--    tiene que llevar el plan que se esta comprando, y el espacio lo cambia
--    cuando el pago se aprueba.
alter table public.workspaces
  add column if not exists razon_social text,
  add column if not exists datos_legales_el timestamptz;

comment on column public.workspaces.datos_legales_el is
  'Cuando el cliente registro sus datos legales. Con esta marca puesta, el cliente ya no puede editarlos.';

alter table public.payments
  add column if not exists plan_id uuid references public.plans(id) on delete set null;

comment on column public.payments.plan_id is
  'Plan que se compra con este pago. Se aplica al espacio al aprobarlo, y solo si el monto coincide con el precio del plan.';

create or replace function public.proteger_datos_legales()
returns trigger
language plpgsql
as $$
begin
  if (new.razon_social, new.documento_tipo, new.documento_numero, new.direccion, new.datos_legales_el)
     is distinct from
     (old.razon_social, old.documento_tipo, old.documento_numero, old.direccion, old.datos_legales_el)
  then
    -- Solo se frena a quien entra con sesion de cliente. El rol de servicio y
    -- los accesos de mantenimiento (postgres) pasan, igual que un administrador.
    if current_user in ('authenticated', 'anon') and not (select public.is_platform_admin()) then
      raise exception 'Los datos legales no se pueden editar. Escribe a soporte si necesitas corregirlos.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_proteger_datos_legales on public.workspaces;
create trigger workspaces_proteger_datos_legales
  before update on public.workspaces
  for each row execute function public.proteger_datos_legales();

select pg_notify('pgrst', 'reload schema');
