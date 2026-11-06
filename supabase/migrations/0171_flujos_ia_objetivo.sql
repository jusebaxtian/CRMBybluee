-- Bloque "IA con objetivo": la IA conversa dentro del flujo hasta cumplir su
-- objetivo o llegar a su tope, y sigue por la salida que corresponda. Esta columna
-- cuenta cuantas respuestas lleva en el bloque actual.
alter table public.flujo_ejecuciones
  add column if not exists ia_respuestas smallint not null default 0;
