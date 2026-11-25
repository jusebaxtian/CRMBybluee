-- Cursos y servicios de pago (25 nov 2026): algunos se compran una sola vez
-- (un curso: queda comprado para siempre) y otros se pueden comprar las veces
-- que se necesiten (un servicio de 1 hora de asesoria). Con la casilla
-- encendida, el cliente sigue viendo el boton de comprar despues de cada compra.
-- Apagada por defecto: los cursos de hoy siguen siendo de compra unica.

alter table public.cursos add column if not exists compra_repetible boolean not null default false;
