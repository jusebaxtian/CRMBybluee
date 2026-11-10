-- Todos los pagos en linea que Bold avisa por su webhook (9 nov 2026): boton,
-- link de pago, PSE, Nequi, QR, Bancolombia. Antes el webhook solo miraba las
-- ordenes del CRM y descartaba el resto; ahora se guarda cada uno para verlo en
-- Admin -> Pagos, sea del producto que sea.
-- Solo lo lee y escribe el servidor (llave de servicio): no hay politicas.

create table if not exists public.bold_pagos (
  id uuid primary key default gen_random_uuid(),
  -- El id de la transaccion en Bold. Bold puede avisar varias veces lo mismo.
  payment_id text not null unique,
  ultimo_evento text not null,
  estado text not null check (estado in ('aprobado', 'rechazado', 'anulado', 'anulacion_rechazada')),
  monto numeric(14, 2),
  currency text,
  metodo text,
  integracion text,
  -- order-id del boton, LNK_... del link de pago, o lo que se haya puesto.
  referencia text,
  correo_pagador text,
  pagado_el timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bold_pagos_fecha_idx on public.bold_pagos (coalesce(pagado_el, created_at) desc);
create index if not exists bold_pagos_referencia_idx on public.bold_pagos (referencia);

alter table public.bold_pagos enable row level security;
revoke all on public.bold_pagos from anon, authenticated;
grant select, insert, update on public.bold_pagos to service_role;

select pg_notify('pgrst', 'reload schema');
