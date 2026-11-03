-- Quien envio cada mensaje (decision del 3 nov 2026, modelo 1: el nombre arriba
-- del mensaje en el chat, solo lo ve el equipo).
--
-- sent_by_user_id: la persona del equipo que lo envio. Lo llena un disparador con
-- la sesion de quien inserta, asi no depende de cada pantalla que envia (chat,
-- reenviar, agenda...). Los procesos de fondo usan la llave de servicio, sin
-- sesion, y lo dejan vacio.
-- origen: lo que no es una persona: ia, campana, flujo, api, sistema.
-- Los mensajes de antes de esto no tienen ninguno de los dos.

alter table public.messages add column if not exists sent_by_user_id uuid references auth.users(id) on delete set null;
alter table public.messages add column if not exists origen text;

create or replace function public.messages_quien_envia()
returns trigger
language plpgsql
as $$
begin
  if new.direction = 'out' and new.sent_by_user_id is null and auth.uid() is not null then
    new.sent_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists messages_quien_envia on public.messages;
create trigger messages_quien_envia
  before insert on public.messages
  for each row execute function public.messages_quien_envia();

select pg_notify('pgrst', 'reload schema');
