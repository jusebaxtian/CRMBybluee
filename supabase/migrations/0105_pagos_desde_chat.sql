-- Registrar pagos desde la bandeja del administrador.
--
-- El cliente manda el comprobante por WhatsApp al chat de soporte. Desde ese
-- mensaje el admin registra el pago:
--   * si el contacto ya tiene espacio: pago aprobado + plan + suscripcion,
--     todo de una;
--   * si no: queda una "invitacion de registro" con un enlace unico. Cuando
--     la persona se registra por ese enlace, su espacio nace activo con el
--     plan pagado y el pago enlazado.

begin;

-- De donde salio el pago: el propio cliente (formulario/Bold) o soporte desde el chat.
alter table payments
  add column if not exists source text not null default 'cliente'
  check (source in ('cliente', 'bold', 'soporte'));

create table if not exists invitaciones_registro (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  contact_id uuid references contacts(id) on delete set null,
  phone text not null,
  plan_id uuid not null references plans(id),
  amount_cents bigint not null,
  currency text not null default 'COP',
  proof_path text,
  nota text,
  status text not null default 'pending' check (status in ('pending', 'used', 'canceled')),
  workspace_id uuid references workspaces(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table invitaciones_registro enable row level security;
drop policy if exists "invitaciones_admin" on invitaciones_registro;
create policy "invitaciones_admin" on invitaciones_registro
  for all using (is_platform_admin()) with check (is_platform_admin());

-- Lo que ve la persona al abrir el enlace (sin sesion): telefono, plan y monto.
create or replace function invitacion_registro_publica(p_token text)
returns table (phone text, plan_name text, amount_cents bigint, currency text)
language sql
stable
security definer
set search_path = public
as $$
  select i.phone, p.name, i.amount_cents, i.currency
  from invitaciones_registro i
  join plans p on p.id = i.plan_id
  where i.token = p_token and i.status = 'pending';
$$;
revoke all on function invitacion_registro_publica(text) from public;
grant execute on function invitacion_registro_publica(text) to anon, authenticated;

commit;
