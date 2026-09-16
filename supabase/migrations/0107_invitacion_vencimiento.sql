-- Pagos desde el chat: fecha de vencimiento personalizada.
-- Soporte puede fijar a mano hasta cuando queda activo el espacio (planes
-- negociados); si no la pone, se calcula con el ciclo del plan.
alter table public.invitaciones_registro add column if not exists vence_el timestamptz;
