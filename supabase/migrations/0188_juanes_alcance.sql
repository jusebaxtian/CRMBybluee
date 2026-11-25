-- Agente Juanes (25 nov 2026): a que chats responde.
--
-- Hasta ahora, encendido, respondia en todas las lineas y todos los chats.
-- Ahora se elige:
--   * Lineas: todas, o solo las elegidas (lineas_ids).
--   * Asesor del chat: todos, o solo los chats asignados a los asesores
--     elegidos (asesores_ids: id del usuario, o 'sin_asignar' para los chats
--     que no tienen asesor).
-- Los chats que quedan fuera siguen como siempre: los atiende el agente de IA
-- de su linea, si lo tiene, o nadie. Los numeros de prueba siguen recibiendo
-- respuesta siempre.
--
-- Por defecto: todas y todos (nada cambia hasta que se elija).

alter table public.agente_vendedor
  add column if not exists lineas_modo text not null default 'todas',
  add column if not exists lineas_ids uuid[] not null default '{}',
  add column if not exists asesores_modo text not null default 'todos',
  add column if not exists asesores_ids text[] not null default '{}';

alter table public.agente_vendedor drop constraint if exists agente_vendedor_lineas_modo_check;
alter table public.agente_vendedor add constraint agente_vendedor_lineas_modo_check check (lineas_modo in ('todas', 'seleccionadas'));
alter table public.agente_vendedor drop constraint if exists agente_vendedor_asesores_modo_check;
alter table public.agente_vendedor add constraint agente_vendedor_asesores_modo_check check (asesores_modo in ('todos', 'seleccionados'));
