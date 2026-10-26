-- Wompi como tercera forma de pago (junto a Bold y la transferencia manual).
--
-- `wompi_reference` es la referencia unica que el servidor genera al armar el
-- cobro (y que Wompi devuelve en la transaccion); `wompi_transaction_id` se
-- llena al confirmarse. La unicidad de la referencia evita que un mismo pago
-- se aplique dos veces cuando llegan a la vez el aviso (webhook) y el regreso
-- del cliente.

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check check (provider in ('bold', 'manual', 'wompi'));

alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('bold', 'manual', 'wompi'));

alter table public.payments
  add column if not exists wompi_reference text,
  add column if not exists wompi_transaction_id text;

create unique index if not exists payments_wompi_reference_uniq
  on public.payments (wompi_reference) where wompi_reference is not null;

notify pgrst, 'reload schema';
