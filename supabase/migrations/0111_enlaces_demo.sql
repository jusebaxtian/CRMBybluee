-- Enlaces de registro tipo "demo": cuenta activa sin pago por N dias.
--
-- Mismo mecanismo que el enlace con pago (0105): soporte genera un enlace
-- personalizado; al registrarse con el, el espacio nace activo con el plan
-- elegido hasta que se cumplan los dias. Sin comprobante ni pago. Puede
-- crearse desde el chat (ligado al contacto) o desde Admin -> Pagos sin
-- contacto, por eso el telefono pasa a ser opcional.

alter table public.invitaciones_registro
  add column if not exists tipo text not null default 'pago' check (tipo in ('pago', 'demo')),
  add column if not exists dias_demo integer check (dias_demo is null or dias_demo between 1 and 365),
  add column if not exists nombre text;

alter table public.invitaciones_registro alter column phone drop not null;

drop function if exists public.invitacion_registro_publica(text);
create or replace function public.invitacion_registro_publica(p_token text)
returns table (phone text, plan_name text, amount_cents bigint, currency text, tipo text, dias_demo integer)
language sql
stable
security definer
set search_path = public
as $$
  select i.phone, p.name, i.amount_cents, i.currency, i.tipo, i.dias_demo
  from invitaciones_registro i
  join plans p on p.id = i.plan_id
  where i.token = p_token and i.status = 'pending';
$$;
revoke all on function public.invitacion_registro_publica(text) from public;
grant execute on function public.invitacion_registro_publica(text) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
